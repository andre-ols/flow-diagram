"use client";

import type { ReactNode } from "react";
import type {
  Artifact,
  ErModelArtifact,
  HttpExchangeArtifact,
  ImageArtifact,
  JsonPayloadArtifact,
} from "@flow/lang";
import { ErModelView } from "./er-model-view";
import { HttpExchangeView } from "./http-exchange-view";
import { ImageView } from "./image-view";
import { JsonPayloadView } from "./json-payload-view";

type Renderer<A extends Artifact> = (props: { artifact: A }) => ReactNode;

/**
 * The whole detail panel is this map. Node kinds do not appear anywhere in it:
 * a node's views come from the artifacts it carries, so a new view is a new
 * entry here and nothing else changes.
 */
export const artifactRenderers: {
  "http-exchange": Renderer<HttpExchangeArtifact>;
  "er-model": Renderer<ErModelArtifact>;
  "json-payload": Renderer<JsonPayloadArtifact>;
  image: Renderer<ImageArtifact>;
} = {
  "http-exchange": HttpExchangeView,
  "er-model": ErModelView,
  "json-payload": JsonPayloadView,
  image: ImageView,
};

/**
 * The compiler checks this switch for exhaustiveness: add a fifth artifact kind
 * to the language and this file stops compiling until it has a view.
 */
export function ArtifactView({ artifact }: { artifact: Artifact }): ReactNode {
  switch (artifact.kind) {
    case "http-exchange":
      return <HttpExchangeView artifact={artifact} />;
    case "er-model":
      return <ErModelView artifact={artifact} />;
    case "json-payload":
      return <JsonPayloadView artifact={artifact} />;
    case "image":
      return <ImageView artifact={artifact} />;
  }
}
