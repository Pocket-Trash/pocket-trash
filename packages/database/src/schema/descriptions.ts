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
  resource_categories: {
    description: "Reusable categories assigned to resources.",
  },
  resource_downloads: {
    description: "Append-only download events for resource versions.",
  },
  resource_images: {
    description: "Ordered resource images; position zero is the cover image.",
  },
  resource_notifications: {
    description:
      "Admin review events created for new resources and categories.",
  },
  resource_upload_files: {
    description:
      "Declared files and upload state for resumable resource upload sessions.",
  },
  resource_upload_sessions: {
    description: "Authenticated resource creation and version upload sessions.",
  },
  resource_versions: {
    description: "Immutable uploaded file versions for resources.",
  },
  resources: {
    description: "User-uploaded resources with files, images, and versions.",
  },
  resources_to_categories: {
    description: "Unique resource-to-category assignments.",
  },
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
  collection_item: {
    description:
      "Shared ownership and lifecycle row for user collection items.",
    columns: {
      id: {
        description: "Internal collection item row identifier.",
        example: 1000,
      },
      owner_id: {
        description: "User who owns or owned the collection item.",
        example: 1000,
      },
      material_id: {
        description: "Exact material of the owned physical item.",
        example: 1000,
      },
      purchased_at: {
        description: "Timestamp when the item was purchased.",
        example: "2026-07-17T20:45:00.000Z",
      },
      sold_at: {
        description: "Timestamp when the item was sold.",
        example: "2026-08-17T20:45:00.000Z",
      },
      purchased_from_user_id: {
        description: "Known application user the item was purchased from.",
        example: 1001,
      },
      purchased_from_user: {
        description:
          "Free-text seller name when no application user row exists.",
        example: "KAP EDC",
      },
      sold_to_user_id: {
        description: "Known application user the item was sold to.",
        example: 1002,
      },
      sold_to_user: {
        description:
          "Free-text buyer name when no application user row exists.",
        example: "Private buyer",
      },
      owned: {
        description: "Whether the item is currently owned by the owner.",
        example: true,
      },
    },
  },
  product: {
    description: "Shared catalog product identity for supported product types.",
    columns: {
      id: { description: "Internal product identifier.", example: 1000 },
      product_type_id: {
        description: "Product type classification.",
        example: 1000,
      },
      maker_id: {
        description: "Maker that produced the product.",
        example: 1000,
      },
      name: {
        description: "Human-readable product name.",
        example: "Standard Katla",
      },
      slug: {
        description: "Stable product slug within its type.",
        example: "standard-katla",
      },
    },
  },
  product_material: {
    description: "Materials in which a catalog product is available.",
    columns: {
      product_id: { description: "Catalog product.", example: 1000 },
      material_id: {
        description: "Available canonical material.",
        example: 1000,
      },
    },
  },
  finish: {
    description: "Canonical atomic product finish values.",
    columns: {
      id: { description: "Internal finish identifier.", example: 1000 },
      name: { description: "Human-readable finish name.", example: "Polished" },
      slug: { description: "Stable finish slug.", example: "polished" },
      created_at: { description: "Timestamp when the finish was created." },
      updated_at: {
        description: "Timestamp when the finish was last updated.",
      },
    },
  },
  color: {
    description: "Canonical atomic colour values used by finish options.",
    columns: {
      id: { description: "Internal colour identifier.", example: 1000 },
      name: { description: "Human-readable colour name.", example: "Blue" },
      slug: { description: "Stable colour slug.", example: "blue" },
      hex: { description: "Six-digit display colour.", example: "#2563EB" },
      created_at: { description: "Timestamp when the colour was created." },
      updated_at: {
        description: "Timestamp when the colour was last updated.",
      },
    },
  },
  color_effect: {
    description: "Supported relationships between finish-option colours.",
    columns: {
      id: { description: "Internal colour-effect identifier.", example: 1000 },
      name: { description: "Human-readable effect name.", example: "Fade" },
      slug: { description: "Stable colour-effect slug.", example: "fade" },
      created_at: { description: "Timestamp when the effect was created." },
      updated_at: {
        description: "Timestamp when the effect was last updated.",
      },
    },
  },
  finish_option: {
    description:
      "Ordered finish composition owned by one product or collection item.",
    columns: {
      id: { description: "Internal finish-option identifier.", example: 1000 },
      product_id: {
        description: "Product that offers this option.",
        example: 1000,
      },
      collection_item_id: {
        description: "Collection item that owns this snapshot.",
        example: 1000,
      },
      source_product_finish_option_id: {
        description: "Product option copied into a collection snapshot.",
        example: 1001,
      },
      color_effect_id: {
        description: "Optional relationship between selected colours.",
        example: 1000,
      },
      position: { description: "Zero-based option display order.", example: 0 },
    },
  },
  finish_option_finish: {
    description: "Ordered atomic finishes in a finish option.",
    columns: {
      finish_option_id: { description: "Owning finish option.", example: 1000 },
      finish_id: { description: "Selected atomic finish.", example: 1000 },
      position: { description: "Zero-based finish display order.", example: 0 },
    },
  },
  finish_option_color: {
    description: "Ordered atomic colours in a finish option.",
    columns: {
      finish_option_id: { description: "Owning finish option.", example: 1000 },
      color_id: { description: "Selected atomic colour.", example: 1000 },
      position: { description: "Zero-based colour display order.", example: 0 },
    },
  },
  product_spinner: {
    description: "Catalog spinner product row.",
    columns: {
      id: {
        description: "Internal product spinner row identifier.",
        example: 1000,
      },
      weight_g: {
        description: "Spinner weight in grams.",
        example: "72.5",
      },
      length_mm: {
        description: "Spinner length in millimeters.",
        example: "50.0",
      },
      width_mm: {
        description: "Spinner width in millimeters.",
        example: "24.5",
      },
      thickness_mm: {
        description: "Spinner body thickness in millimeters.",
        example: "10.0",
      },
      thickness_with_button_mm: {
        description:
          "Spinner thickness including installed buttons in millimeters.",
        example: "17.0",
      },
      button_diameter_mm: {
        description: "Compatible button diameter in millimeters.",
        example: "24.5",
      },
      compatible_button_id: {
        description: "Catalog spinner button selected for this spinner.",
        example: 1001,
      },
      created_at: {
        description: "Timestamp when the spinner row was created.",
        example: "2026-07-17T20:45:00.000Z",
      },
      updated_at: {
        description: "Timestamp when the spinner row was last updated.",
        example: "2026-07-17T20:45:00.000Z",
      },
    },
  },
  product_spinner_button: {
    description: "Catalog spinner button product row.",
    columns: {
      id: {
        description: "Internal product spinner button row identifier.",
        example: 1000,
      },
      weight_g: {
        description: "Spinner button weight in grams.",
        example: "8.4",
      },
      diameter_mm: {
        description: "Spinner button diameter in millimeters.",
        example: "24.5",
      },
      thickness_mm: {
        description: "Spinner button thickness in millimeters.",
        example: "7.0",
      },
      created_at: {
        description: "Timestamp when the spinner button row was created.",
        example: "2026-07-17T20:45:00.000Z",
      },
      updated_at: {
        description: "Timestamp when the spinner button row was last updated.",
        example: "2026-07-17T20:45:00.000Z",
      },
    },
  },
  collection_spinner: {
    description: "User collection row for a spinner.",
    columns: {
      id: {
        description: "Collection item row identifier for this spinner.",
        example: 1000,
      },
      product_spinner_id: {
        description: "Catalog spinner this collection item represents.",
        example: 1000,
      },
      installed_button_id: {
        description:
          "Owned spinner button currently installed on this spinner.",
        example: 1001,
      },
    },
  },
  collection_spinner_button: {
    description: "User collection row for a spinner button.",
    columns: {
      id: {
        description: "Collection item row identifier for this spinner button.",
        example: 1001,
      },
      product_spinner_button_id: {
        description: "Catalog spinner button this collection item represents.",
        example: 1000,
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
