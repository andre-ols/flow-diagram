import { nestedBlock, nestedBlocks, propValue } from "../parser/ast";
import type {
  ErField,
  ErModelArtifact,
  ErRef,
  ErTable,
  HttpExchangeArtifact,
} from "../ir/artifacts";
import { createRegistry, type NodeTypeDef, type NodeTypeRegistry, type PropDef } from "./types";

/** `flow` is structural, not a node type, so it is never in the registry. */
export const FLOW_KEYWORD = "flow";

const DESC: PropDef = { name: "desc", kind: "string" };

const screen: NodeTypeDef = {
  keyword: "screen",
  label: "SCREEN",
  colorToken: "--kind-screen",
  entryMode: "properties",
  props: [DESC, { name: "image", kind: "string" }],
  blocks: [],
  toArtifacts(block) {
    const src = propValue(block, "image");
    if (!src) return [];
    return [{ kind: "image", src, alt: block.label ?? block.id }];
  },
};

const service: NodeTypeDef = {
  keyword: "service",
  label: "SERVICE",
  colorToken: "--kind-service",
  entryMode: "properties",
  props: [DESC, { name: "external", kind: "boolean" }],
  blocks: [],
  toArtifacts: () => [],
};

const http: NodeTypeDef = {
  keyword: "http",
  label: "HTTP",
  colorToken: "--kind-http",
  entryMode: "properties",
  props: [
    DESC,
    {
      name: "method",
      kind: "enum",
      required: true,
      values: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    },
    { name: "path", kind: "bare", required: true },
  ],
  blocks: [
    {
      keyword: "request",
      arity: "one",
      entryMode: "properties",
      props: [{ name: "payload", kind: "code" }],
    },
    {
      keyword: "response",
      arity: "one",
      entryMode: "properties",
      props: [
        { name: "status", kind: "bare" },
        { name: "payload", kind: "code" },
      ],
    },
  ],
  toArtifacts(block) {
    const artifact: HttpExchangeArtifact = {
      kind: "http-exchange",
      method: (propValue(block, "method") ?? "").toUpperCase(),
      path: propValue(block, "path") ?? "",
    };

    const request = nestedBlock(block, "request");
    if (request) {
      const payload = propValue(request, "payload");
      artifact.request = payload === undefined ? {} : { payload };
    }

    const response = nestedBlock(block, "response");
    if (response) {
      const payload = propValue(response, "payload");
      artifact.response = {
        status: propValue(response, "status") ?? "200",
        ...(payload === undefined ? {} : { payload }),
      };
    }

    return [artifact];
  },
};

function toErField(entry: { name: string; fieldType: string; flags: string[] }): ErField {
  const flags = entry.flags.map((flag) => flag.toLowerCase());
  return {
    name: entry.name,
    type: entry.fieldType,
    pk: flags.includes("pk"),
    fk: flags.includes("fk"),
    notNull: flags.includes("not null") || flags.includes("nn"),
  };
}

const db: NodeTypeDef = {
  keyword: "db",
  label: "DATABASE",
  colorToken: "--kind-db",
  entryMode: "properties",
  allowRefs: true,
  props: [DESC],
  blocks: [{ keyword: "table", arity: "many", entryMode: "fields", props: [] }],
  toArtifacts(block) {
    const tables: ErTable[] = nestedBlocks(block, "table").map((table) => ({
      name: table.id,
      fields: table.entries
        .filter((entry) => entry.type === "field")
        .map((entry) => toErField(entry)),
    }));

    const refs: ErRef[] = block.entries
      .filter((entry) => entry.type === "ref")
      .map((entry) => ({
        fromTable: entry.from.table,
        fromField: entry.from.column,
        toTable: entry.to.table,
        toField: entry.to.column,
        op: entry.op,
      }));

    const model: ErModelArtifact = { kind: "er-model", tables, refs };
    return [model];
  },
};

const topic: NodeTypeDef = {
  keyword: "topic",
  label: "TOPIC",
  colorToken: "--kind-topic",
  entryMode: "properties",
  props: [
    DESC,
    // Free text on purpose: moving from Kafka to SQS must never require a new
    // node type.
    { name: "broker", kind: "bare" },
    { name: "payload", kind: "code" },
  ],
  blocks: [],
  toArtifacts(block) {
    const json = propValue(block, "payload");
    if (!json) return [];
    return [{ kind: "json-payload", title: "Message", json }];
  },
};

export const defaultRegistry: NodeTypeRegistry = createRegistry([
  screen,
  service,
  http,
  db,
  topic,
]);

export { createRegistry };
