/**
 * This module expects you to have the ghostscript executable. You have to supply its path to the functions or set GS_EXE env variable to the exact binary file
 */

import { spawn } from "child_process";
import { Transform, Readable } from "stream";

export type ImageResolution = {
  dpi: number;
  width: number;
  height: number;
};

const defaultResolution: ImageResolution = {
  dpi: 300,
  width: 1025,
  height: 1500
};

/**
 *
 * @param gsPath Path to binary file
 * @param resolution Image resolution
 * @returns Transform stream object that takes a pdf binary and spits out a bmp binary
 */
export function transformPdf(
  gsPath: string | undefined,
  resolution: ImageResolution
): Transform {
  if (!gsPath) {
    gsPath = process.env.GS_EXE;
  }

  if (!gsPath) {
    throw new Error("GS_EXE environment variable must be set");
  }

  // resolution = { ...defaultResolution, ...(resolution || {}) };

  const t = new Transform();
  let cacheError: Error;

  const W = Math.floor((resolution.dpi * resolution.width) / 254.0);
  const H = Math.floor((resolution.dpi * resolution.height) / 254.0);
  const resize = "-g" + W + "x" + H;

  const cmd = [
    "-sDEVICE=bmpmono",
    "-sOutputFile=%stdout",
    "-q",
    "-r" + resolution.dpi,
    resize,
    "-dPDFFitPage",
    "-"
  ];

  const p = spawn(gsPath, cmd);
  p.stderr.pipe(process.stderr);
  const onError = (e: Error) => (cacheError = e);
  p.on("error", onError);

  t._transform = (data, encoding, callback) => {
    if (cacheError) {
      callback(cacheError);
      return t.destroy();
    }
    p.stdin.write(data);
    callback();
  };

  t._flush = callback => {
    if (cacheError) {
      callback(cacheError);
      return t.destroy();
    }
    p.removeListener("error", onError);
    p.on("error", callback);
    p.stdin.end();
    p.stdout.on("data", data => t.push(data));
    p.stdout.on("end", callback);
  };

  return t;
}

export function curriedTransformPdf(
  gsPath: string | undefined
): (resolution: ImageResolution) => Transform {
  if (!gsPath) {
    gsPath = process.env.GS_EXE;
  }

  if (!gsPath) {
    throw new Error("GS_EXE environment variable must be set");
  }
  return function(resolution: ImageResolution) {
    return transformPdf(gsPath, resolution);
  };
}
