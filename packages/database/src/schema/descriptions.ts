export type SchemaDescription = {
  columns?: Record<
    string,
    {
      description?: string;
      example?: unknown;
    }
  >;
  description?: string;
};

export const schemaDescriptions = {
  makers: {
    description:
      "Canonical source makers that scraped or user-created products can belong to.",
    columns: {
      id: {
        description: "Internal maker row identifier.",
        example: 1000,
      },
      name: {
        description: "Human-readable maker name.",
        example: "Autmog",
      },
      root_url: {
        description: "Canonical root URL for the maker source.",
        example: "https://www.autmog.com",
      },
      created_at: {
        description: "Timestamp when the maker row was created.",
        example: "2026-07-17T20:45:00.000Z",
      },
      updated_at: {
        description: "Timestamp when the maker row was last updated.",
        example: "2026-07-17T20:45:00.000Z",
      },
    },
  },
  materials: {
    description:
      "Canonical material values shared across scraped and user-created products.",
    columns: {
      id: {
        description: "Internal material row identifier.",
        example: 1000,
      },
      name: {
        description: "Canonical display name for the material.",
        example: "6al-4v titanium",
      },
      slug: {
        description: "Stable slug for material deduplication and lookups.",
        example: "6al-4v-titanium",
      },
      created_at: {
        description: "Timestamp when the material row was created.",
        example: "2026-07-17T20:45:00.000Z",
      },
      updated_at: {
        description: "Timestamp when the material row was last updated.",
        example: "2026-07-17T20:45:00.000Z",
      },
    },
  },
  mechanisms: {
    description:
      "Canonical pen mechanism values shared across scraped and user-created products.",
    columns: {
      id: {
        description: "Internal mechanism row identifier.",
        example: 1000,
      },
      name: {
        description: "Canonical display name for the mechanism.",
        example: "click",
      },
      slug: {
        description: "Stable slug for mechanism deduplication and lookups.",
        example: "click",
      },
      created_at: {
        description: "Timestamp when the mechanism row was created.",
        example: "2026-07-17T20:45:00.000Z",
      },
      updated_at: {
        description: "Timestamp when the mechanism row was last updated.",
        example: "2026-07-17T20:45:00.000Z",
      },
    },
  },
  product_types: {
    description:
      "Canonical product type values used to classify product aggregate rows.",
    columns: {
      id: {
        description: "Internal product type row identifier.",
        example: 1000,
      },
      name: {
        description: "Canonical display name for the product type.",
        example: "pen",
      },
      slug: {
        description: "Stable slug for product type deduplication and lookups.",
        example: "pen",
      },
      created_at: {
        description: "Timestamp when the product type row was created.",
        example: "2026-07-17T20:45:00.000Z",
      },
      updated_at: {
        description: "Timestamp when the product type row was last updated.",
        example: "2026-07-17T20:45:00.000Z",
      },
    },
  },
  scraper_runs: {
    description:
      "Execution log for scraper producer, processor, and dead-letter jobs.",
    columns: {
      id: {
        description: "Internal scraper run row identifier.",
        example: 1000,
      },
      source: {
        description: "Scraper source or subsystem that ran.",
        example: "autmog",
      },
      job_type: {
        description: "Kind of scraper job that ran.",
        example: "producer",
      },
      status: {
        description: "Current lifecycle state for the run.",
        example: "completed",
      },
      started_at: {
        description: "Timestamp when the run started.",
        example: "2026-07-17T20:45:00.000Z",
      },
      finished_at: {
        description: "Timestamp when the run finished.",
        example: "2026-07-17T20:45:42.000Z",
      },
      heartbeat_at: {
        description: "Timestamp of the latest run heartbeat, when present.",
        example: "2026-07-17T20:45:20.000Z",
      },
      error_message: {
        description: "Failure summary captured for failed runs.",
        example: "Run marked failed after exceeding stale lock threshold.",
      },
      stats: {
        description: "Structured counters emitted by the scraper job.",
        example: {
          enqueuedItemJobs: 142,
          fetchedCount: 141,
        },
      },
    },
  },
  tmp_images: {
    description:
      "Temporary scraper image rows shared by all scraped products and variations.",
    columns: {
      id: {
        description: "Internal image row identifier.",
        example: 1000,
      },
      product_id: {
        description:
          "Generic temporary product row this image belongs to. Product-level images use this id as the image folder key.",
        example: 1000,
      },
      product_variation_id: {
        description:
          "Generic temporary variation row this image belongs to, when the source image is variation-specific.",
        example: 1001,
      },
      source_image_id: {
        description:
          "Source-provided image identifier when available from the scraped site.",
        example: "40219471790203",
      },
      source_url: {
        description: "Remote source URL fetched and uploaded to image storage.",
        example: "https://cdn.shopify.com/s/files/example/image.jpg",
      },
      position: {
        description: "Source image order within the product or variation.",
        example: 1,
      },
      alt_text: {
        description: "Source image alt text, when provided by the source site.",
        example: "Titanium click pen side profile",
      },
      width: {
        description: "Uploaded optimized image width in pixels.",
        example: 2000,
      },
      height: {
        description: "Uploaded optimized image height in pixels.",
        example: 1333,
      },
      source_hash: {
        description:
          "Stable hash of the source image identity used to dedupe image rows within a product or variation.",
        example:
          "sha256:db2ef0e97513c1dc9d75f55ee8c014c06fc31a459c1c25b12904696bf2ab1c55",
      },
      image_provider: {
        description: "Image storage provider that owns the uploaded file.",
        example: "bunny",
      },
      image_file_id: {
        description:
          "Image storage file identifier used for updates and deletes.",
        example: "/preview/pr-52/products/1000-1001/image.webp",
      },
      image_path: {
        description: "Image storage object path.",
        example: "/preview/pr-52/products/1000-1001/image.webp",
      },
      image_url: {
        description: "Optimized uploaded image URL.",
        example:
          "https://cdn.pocket-trash.app/preview/pr-52/products/1000-1001/image.webp",
      },
      status: {
        description: "Image upload/delete lifecycle status.",
        example: "uploaded",
      },
      uploaded_at: {
        description: "Timestamp when the image upload completed.",
        example: "2026-07-17T20:45:42.000Z",
      },
      pending_delete_at: {
        description: "Timestamp when the image was marked for deletion.",
        example: "2026-07-18T20:45:42.000Z",
      },
      deleted_at: {
        description: "Timestamp when the image delete completed.",
        example: "2026-07-18T20:46:12.000Z",
      },
      last_seen_at: {
        description: "Timestamp when the source image last appeared upstream.",
        example: "2026-07-17T20:45:00.000Z",
      },
      created_at: {
        description: "Timestamp when the image row was created.",
        example: "2026-07-17T20:45:00.000Z",
      },
      updated_at: {
        description: "Timestamp when the image row was last updated.",
        example: "2026-07-17T20:45:42.000Z",
      },
    },
  },
  tmp_autmog_pen_materials: {
    description:
      "Join table connecting Autmog pens to canonical material values.",
    columns: {
      pen_id: {
        description: "Autmog pen row that uses the material.",
        example: 1000,
      },
      material_id: {
        description: "Canonical material assigned to the pen.",
        example: 1000,
      },
      created_at: {
        description: "Timestamp when the material assignment was created.",
        example: "2026-07-17T20:45:00.000Z",
      },
    },
  },
  tmp_autmog_pen_versions: {
    description: "Version history for meaningful Autmog pen changes.",
    columns: {
      id: {
        description: "Internal version row identifier.",
        example: 1000,
      },
      pen_id: {
        description: "Autmog pen row this version belongs to.",
        example: 1000,
      },
      source_product_id: {
        description: "Shopify product ID from Autmog.",
        example: "8383420301499",
      },
      previous_details_hash: {
        description: "Previous non-image product details hash.",
        example:
          "sha256:6a5a79355c7cd75eb8ba0837d306f002c90ff349dcb1ba04f45f69e4b7f3f6f5",
      },
      next_details_hash: {
        description: "New non-image product details hash.",
        example:
          "sha256:5dcbd8f834f8b952cf7d8d86ed3273dd6b77cf83ea78f982096a9de7ded135fc",
      },
      previous_image_set_hash: {
        description: "Previous product image set hash.",
        example:
          "sha256:fb4c1136e5580a42246f988d3e8d18e2fc356d48fb687f6192fb797071dd55dc",
      },
      next_image_set_hash: {
        description: "New product image set hash.",
        example:
          "sha256:711b0aab8eff464076516f1d74aedb65efe7f91a680babe4a2c9f3b0ce317fc0",
      },
      snapshot: {
        description: "Normalized product snapshot captured for this version.",
        example: {
          category: "pen",
          title: "40 Clipless Click Pen",
        },
      },
      change_reason: {
        description: "Reason this version row was captured.",
        example: "details_changed",
      },
      captured_at: {
        description: "Timestamp when the version was captured.",
        example: "2026-07-17T20:45:42.000Z",
      },
      replaced_at: {
        description: "Timestamp when this version was superseded.",
        example: "2026-07-18T20:45:42.000Z",
      },
    },
  },
  tmp_autmog_pens: {
    description: "Latest normalized Autmog pen product records.",
    columns: {
      id: {
        description: "Internal Autmog pen row identifier.",
        example: 1000,
      },
      product_id: {
        description:
          "Generic temporary product row for this source-specific Autmog pen row.",
        example: 1000,
      },
      maker_id: {
        description: "Maker row for Autmog.",
        example: 1000,
      },
      mechanism_id: {
        description: "Canonical mechanism assigned to the pen.",
        example: 1000,
      },
      source_product_id: {
        description: "Shopify product ID from Autmog.",
        example: "8383420301499",
      },
      source_handle: {
        description: "Shopify product handle from Autmog.",
        example: "36-click-pen-6al-4v-titanium",
      },
      title: {
        description: "Normalized product title.",
        example: "36 Click Pen - 6Al-4V Titanium",
      },
      product_url: {
        description: "Canonical Autmog product URL.",
        example: "https://www.autmog.com/products/36-click-pen",
      },
      description: {
        description:
          "Editable product description stored as Markdown, initially converted from source HTML.",
        example: "36 click pen clipless Pilot G2.",
      },
      size: {
        description: "Normalized Autmog body diameter size.",
        example: "36",
      },
      refill: {
        description: "Normalized refill family.",
        example: "Pilot G2",
      },
      nose: {
        description: "Normalized nose shape.",
        example: "cone",
      },
      clip: {
        description: "Normalized clip configuration.",
        example: "clipless",
      },
      grip: {
        description: "Normalized grip style.",
        example: "grip lines",
      },
      finish: {
        description: "Normalized finish.",
        example: "machined",
      },
      body_details: {
        description: "Normalized body-detail descriptors.",
        example: ["grip lines", "rings"],
      },
      tags: {
        description: "Shopify product tags.",
        example: ["pen"],
      },
      variants: {
        description: "Normalized Shopify variants.",
        example: [
          { available: false, price: "176.00", title: "Default Title" },
        ],
      },
      normalized_data: {
        description:
          "Full normalized Autmog product payload used by app features.",
        example: {
          category: "pen",
          title: "36 Click Pen - 6Al-4V Titanium",
        },
      },
      details_hash: {
        description: "Stable hash of normalized non-image product details.",
        example:
          "sha256:abbdf3a59195b10307ec3c49d11e5d4359a165dc79b0b1cd27a748b9ef34e3d8",
      },
      image_set_hash: {
        description: "Stable hash of normalized product image identities.",
        example:
          "sha256:711b0aab8eff464076516f1d74aedb65efe7f91a680babe4a2c9f3b0ce317fc0",
      },
      price_min_cents: {
        description: "Minimum variant price in cents.",
        example: 17600,
      },
      price_max_cents: {
        description: "Maximum variant price in cents.",
        example: 17600,
      },
      currency_code: {
        description: "ISO currency code for scraped prices.",
        example: "USD",
      },
      available_for_sale: {
        description: "Whether any source variant is currently available.",
        example: false,
      },
      archived_at: {
        description: "Timestamp when the product was archived.",
        example: "2026-08-17T20:45:00.000Z",
      },
      created_at: {
        description: "Timestamp when the pen row was created.",
        example: "2026-07-17T20:45:00.000Z",
      },
      updated_at: {
        description: "Timestamp when the pen row was last updated.",
        example: "2026-07-17T20:45:42.000Z",
      },
    },
  },
  tmp_products: {
    description:
      "Generic temporary product rows that source-specific product tables point to.",
    columns: {
      id: {
        description: "Internal product row identifier.",
        example: 1000,
      },
      source: {
        description:
          "Scraper source key that created the product row, such as autmog or grimsmo-saga.",
        example: "grimsmo-saga",
      },
      created_at: {
        description: "Timestamp when the product row was created.",
        example: "2026-07-17T20:45:00.000Z",
      },
      updated_at: {
        description: "Timestamp when the product row was last updated.",
        example: "2026-07-17T20:45:42.000Z",
      },
    },
  },
  tmp_product_variations: {
    description:
      "Generic temporary variation rows for source listings that are variations of a stable product.",
    columns: {
      id: {
        description: "Internal product variation row identifier.",
        example: 1001,
      },
      product_id: {
        description: "Generic temporary product row this variation belongs to.",
        example: 1000,
      },
      source_key: {
        description:
          "Stable variation key from the scraper source. Grimsmo uses the listing handle.",
        example: "saga-1234-5678",
      },
      created_at: {
        description: "Timestamp when the variation row was created.",
        example: "2026-07-17T20:45:00.000Z",
      },
      updated_at: {
        description: "Timestamp when the variation row was last updated.",
        example: "2026-07-17T20:45:42.000Z",
      },
    },
  },
  tmp_product_product_types: {
    description:
      "Join table connecting product aggregate rows to canonical product types.",
    columns: {
      product_id: {
        description: "Product row being classified.",
        example: 1000,
      },
      product_type_id: {
        description: "Canonical product type assigned to the product.",
        example: 1000,
      },
      created_at: {
        description: "Timestamp when the product type assignment was created.",
        example: "2026-07-17T20:45:00.000Z",
      },
    },
  },
  user_settings: {
    description: "Per-user display and preference settings.",
    columns: {
      user_id: {
        description: "User row this settings record belongs to.",
        example: 1000,
      },
      currency_code: {
        description: "Preferred currency for display.",
        example: "USD",
      },
      dimension_unit: {
        description: "Preferred dimension unit for display.",
        example: "in",
      },
      locale: {
        description: "Explicit supported locale for localized app text.",
        example: "es-MX",
      },
      theme: {
        description: "Preferred interface theme.",
        example: "dark",
      },
      weight_unit: {
        description: "Preferred weight unit for display.",
        example: "g",
      },
    },
  },
  users: {
    description: "Application users mirrored from Clerk identity records.",
    columns: {
      id: {
        description: "Internal user row identifier.",
        example: 1000,
      },
      clerk_id: {
        description: "Clerk user identifier.",
        example: "user_2abc123",
      },
    },
  },
} satisfies Record<string, SchemaDescription>;
