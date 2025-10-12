import { readFile } from "fs/promises";

const TYPE_ALIAS_REGEX = /export\s+type[\s\S]+?\};/g;
const LOCAL_TYPE_REGEX = /type\s+[A-Za-z_$][\w$]*\s*=\s*[\s\S]+?\};/g;

function stripTypeAnnotations(code) {
  let transformed = code.replace(TYPE_ALIAS_REGEX, "");
  transformed = transformed.replace(LOCAL_TYPE_REGEX, "");
  transformed = transformed.replace(/\)\s*:\s*([^\{=]+)\s*\{/g, "){\n");
  return transformed;
}

export async function load(url, context, defaultLoad) {
  if (!url.endsWith(".ts")) {
    return defaultLoad(url, context, defaultLoad);
  }

  const source = await readFile(new URL(url));
  const stripped = stripTypeAnnotations(source.toString());
  return {
    format: "module",
    source: stripped,
    shortCircuit: true,
  };
}
