/**
 * An Artifact is a typed sub-document attached to a node. The detail panel
 * dispatches on artifact kind, never on node kind — so a new node type that
 * carries an er-model gets the entity-relationship view for free, and a new
 * view is a new artifact kind plus one renderer.
 */

export interface HttpExchangeArtifact {
  kind: "http-exchange";
  method: string;
  path: string;
  request?: { payload?: string };
  response?: { status: string; payload?: string };
}

export interface ErField {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  notNull: boolean;
}

export interface ErTable {
  name: string;
  fields: ErField[];
}

export interface ErRef {
  fromTable: string;
  fromField: string;
  toTable: string;
  toField: string;
  /** Raw relationship operator as written, e.g. ">", "<", "-", "<>". */
  op: string;
}

export interface ErModelArtifact {
  kind: "er-model";
  tables: ErTable[];
  refs: ErRef[];
}

export interface JsonPayloadArtifact {
  kind: "json-payload";
  title: string;
  json: string;
}

export interface ImageArtifact {
  kind: "image";
  src: string;
  alt?: string;
}

export type Artifact =
  | HttpExchangeArtifact
  | ErModelArtifact
  | JsonPayloadArtifact
  | ImageArtifact;

export type ArtifactKind = Artifact["kind"];
