import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * Object storage for task attachments.
 *
 * Two drivers behind one interface. R2 is the real one; the local driver
 * writes to disk so the whole upload path — the dropzone, the editor, the
 * permission checks on download — is exercised in development and in CI
 * without credentials. Which driver runs is decided by whether R2 is
 * configured, never by NODE_ENV: a misconfigured production should fail
 * loudly rather than quietly start writing files onto a container's disk.
 *
 * Bytes go through the app in both directions. Neither a presigned PUT nor a
 * presigned GET works from a browser until the bucket carries a CORS policy,
 * and a redirect to the bucket also hands the browser a URL that outlives the
 * permission check that produced it. Proxying costs bandwidth and buys back
 * one place where access is decided.
 */

/** Anything larger is rejected before an upload URL is issued. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Uploads are content-typed by the browser, which is a hint and not a fact.
 * The list is an allowlist rather than a blocklist, and deliberately excludes
 * anything a browser would execute if it were ever served inline. SVG is not
 * here for that reason: it is a document that can carry script, and it is the
 * one image type that would have to be handled differently from the rest.
 */
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export function isAllowedType(contentType: string): boolean {
  return ALLOWED_TYPES.has(contentType);
}

/**
 * Images dropped into a description are rendered by an `<img>` pointing at the
 * download route, so they have to come back inline. Everything else is served
 * as a download: these are bytes a colleague uploaded, and this origin holds
 * the viewer's session cookie.
 */
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export function dispositionFor(contentType: string, filename: string): string {
  const kind = INLINE_TYPES.has(contentType) ? "inline" : "attachment";
  // A quote in the filename would end the header value early.
  return `${kind}; filename="${filename.replace(/["\r\n]/g, "")}"`;
}

/**
 * Object keys are generated here, never taken from the client. A filename is
 * user input: left in a key it could traverse out of the prefix, collide with
 * another task's file, or leak into a URL. The original name is kept in the
 * database column instead, which is where it belongs.
 */
export function keyFor(taskId: string, filename: string): string {
  const ext = path.extname(filename).slice(0, 12).toLowerCase();
  const safeExt = /^\.[a-z0-9]+$/.test(ext) ? ext : "";
  return `tasks/${taskId}/${randomUUID()}${safeExt}`;
}

type Driver = {
  name: "r2" | "local";
  /**
   * Writes the bytes. Uploads go through the app rather than straight to the
   * bucket from the browser: a presigned PUT is cross-origin, so it needs a
   * CORS policy on the bucket, and it puts the one place that checks
   * permissions outside the request that actually moves the bytes.
   */
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  read(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
};

const r2Config = () => {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_ENDPOINT,
  } = process.env;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  const endpoint =
    R2_ENDPOINT ??
    (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : null);
  if (!endpoint) return null;
  return {
    bucket: R2_BUCKET,
    endpoint,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  };
};

function r2Driver(config: NonNullable<ReturnType<typeof r2Config>>): Driver {
  // R2 is S3-compatible but has no regions; "auto" is what Cloudflare
  // documents for the S3 API.
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    name: "r2",
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },
    async read(key) {
      const res = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      );
      return new Uint8Array(await res.Body!.transformToByteArray());
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}

const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

function localPath(key: string) {
  // `keyFor` is the only thing that mints keys, but this is the one place a
  // key becomes a filesystem path, so it re-checks rather than trusting it.
  if (key.includes("..") || path.isAbsolute(key)) throw new Error("Bad object key");
  return path.join(LOCAL_ROOT, key);
}

function localDriver(): Driver {
  return {
    name: "local",
    async put(key, body) {
      const file = localPath(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async read(key) {
      return new Uint8Array(await readFile(localPath(key)));
    },
    async remove(key) {
      await unlink(localPath(key)).catch(() => {});
    },
  };
}

export function storage(): Driver {
  const config = r2Config();
  return config ? r2Driver(config) : localDriver();
}

export function usingR2(): boolean {
  return r2Config() !== null;
}
