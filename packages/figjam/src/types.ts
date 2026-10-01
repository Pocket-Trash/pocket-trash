/** Schema identifier required by the FigJam bridge payload format. */
export const payloadSchemaVersion = "figjam-bridge/v1";

/** Actor that originated a FigJam bridge payload. */
export type AgentName = "codex" | "claude" | "user" | "system";

/**
 * Operation the FigJam plugin can apply to a board.
 * Operations run in payload order; connectors are skipped when endpoints are
 * unresolved or the editor lacks connector support. Shape style fields and
 * defaults apply only to rectangle-backed shapes because fallback shapes ignore
 * them.
 */
export type FigjamOperation =
  | {
      /** Section height in pixels. */
      height: number;
      /** Payload-unique operation identifier. */
      id: string;
      /** Visible section title. */
      title: string;
      /** Section operation discriminator. */
      type: "section";
      /** Section width in pixels. */
      width: number;
      /** Horizontal board coordinate in pixels. */
      x: number;
      /** Vertical board coordinate in pixels. */
      y: number;
    }
  | {
      /** Optional FigJam sticky-note color. */
      color?: "blue" | "green" | "pink" | "yellow";
      /** Payload-unique operation identifier. */
      id: string;
      /** Sticky-note text. */
      text: string;
      /** Sticky-note operation discriminator. */
      type: "sticky";
      /** Horizontal board coordinate in pixels. */
      x: number;
      /** Vertical board coordinate in pixels. */
      y: number;
    }
  | {
      /**
       * Optional six-digit hex fill color; `none` removes the fill.
       *
       * @default #ffffff
       */
      fill?: string;
      /**
       * Optional text size in pixels.
       *
       * @default 12
       */
      fontSize?: number;
      /** Shape height in pixels. */
      height: number;
      /** Payload-unique operation identifier. */
      id: string;
      /**
       * Optional corner radius in pixels.
       *
       * @default 8
       */
      radius?: number;
      /**
       * Optional six-digit hex stroke color.
       *
       * @default #d4d4d4
       */
      stroke?: string;
      /** Optional text rendered inside the shape. */
      text?: string;
      /**
       * Optional horizontal text alignment.
       *
       * @default left
       */
      textAlign?: "center" | "left";
      /**
       * Optional six-digit hex text color.
       *
       * @default #171717
       */
      textColor?: string;
      /**
       * Optional inner text padding in pixels.
       *
       * @default 10
       */
      textPadding?: number;
      /**
       * Optional text placement inside the shape.
       *
       * @default top-left
       */
      textPosition?: "center" | "top-left";
      /** Shape operation discriminator. */
      type: "shape";
      /** Shape width in pixels. */
      width: number;
      /** Horizontal board coordinate in pixels. */
      x: number;
      /** Vertical board coordinate in pixels. */
      y: number;
    }
  | {
      /** Source operation identifier connected by the line. */
      from: string;
      /** Payload-unique operation identifier. */
      id: string;
      /** Optional connector label. */
      text?: string;
      /** Destination operation identifier connected by the line. */
      to: string;
      /** Connector operation discriminator. */
      type: "connector";
    }
  | {
      /** Payload-unique operation identifier. */
      id: string;
      /** Stamp text or emoji. */
      text: string;
      /** Stamp operation discriminator. */
      type: "stamp";
      /** Horizontal board coordinate in pixels. */
      x: number;
      /** Vertical board coordinate in pixels. */
      y: number;
    };

/** Versioned batch of operations destined for one FigJam file. */
export type FigjamPayload = {
  /** Figma file key receiving the operations. */
  fileKey: string;
  /** Ordered operations; connectors may reference only earlier created nodes. */
  operations: FigjamOperation[];
  /** Identifier used to track and acknowledge the payload. */
  payloadId: string;
  /** Bridge schema version used to validate the payload. */
  schemaVersion: typeof payloadSchemaVersion;
  /** Provenance recorded for the payload. */
  source: {
    /** Actor that created the payload. */
    agent: AgentName;
    /** Optional source branch name. */
    branch?: string;
    /** Optional source commit identifier. */
    commit?: string;
    /** Creation timestamp supplied by the payload source. */
    createdAt: string;
    /** Optional task that prompted the payload. */
    task?: string;
  };
};

/** Credentials and allowlist used for Figma API requests. */
export type FigmaApiConfig = {
  /** Figma access token sent with API requests. */
  accessToken: string;
  /** File keys the local tooling may access. */
  allowedFileKeys: readonly string[];
  /** File key used when a command omits one. */
  defaultFileKey: string;
};

/** Comment fields consumed from the Figma comments API. */
export type FigmaComment = {
  /** API timestamp when the comment was created. */
  created_at?: string;
  /** File key associated with the comment. */
  file_key?: string;
  /** Figma comment identifier. */
  id?: string;
  /** Comment text. */
  message?: string;
  /** Comment author metadata. */
  user?: {
    /** Display handle of the comment author. */
    handle?: string;
  };
};

/** Figma file response and comments captured at one point in time. */
export type FigjamSnapshot = {
  /** Comments returned for the file in Figma response order. */
  comments?: FigmaComment[];
  /** ISO timestamp when the snapshot was fetched. */
  fetchedAt: string;
  /** Unmodified Figma file API response. */
  file: unknown;
  /** Figma file key represented by the snapshot. */
  fileKey: string;
};

/** Notable Figma document node retained for summaries and cache output. */
export type FigjamSummaryNode = {
  /** Text found directly on the node or its text child. */
  characters?: string;
  /** Figma node identifier. */
  id: string;
  /** Optional Figma node name. */
  name?: string;
  /** Figma node type. */
  type: string;
};
