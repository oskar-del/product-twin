import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const inputPaths = [
  path.join(ROOT, 'data/identity/shopify-design-public-model3d-candidates.json'),
  path.join(ROOT, 'data/identity/shopify-furniture-model3d-candidates.json'),
];
const outputPath = path.join(ROOT, 'data/metrics/shopify-design-public-product-media-latest.json');
const runtimeRoot = path.join(ROOT, '.runtime/shopify-design-public-product-media');
const inputs = await Promise.all(inputPaths.map(async (inputPath) => JSON.parse(await fs.readFile(inputPath, 'utf8'))));
const candidates = [...new Map(inputs.flatMap((input) => input.candidates ?? []).map((candidate) => [candidate.identity.merchant_product_gid, candidate])).values()];
const merchantOrigin = inputs.flatMap((input) => [input.summary?.merchant_origin, input.candidates?.[0]?.merchant_origin]).find(Boolean);
const endpoint = `${merchantOrigin}/api/2026-07/graphql.json`;
const generatedAt = new Date().toISOString();

const query = `query ProductTwinMerchantMediaAudit($handle: String!) {
  product(handle: $handle) {
    id
    title
    vendor
    handle
    featuredImage { id url width height altText }
    variants(first: 100) {
      nodes { id title sku image { id url width height altText } }
    }
    media(first: 100) {
      nodes {
        id
        mediaContentType
        alt
        previewImage { id url width height altText }
        ... on MediaImage { image { id url width height altText } }
        ... on Video { sources { url format mimeType width height } }
        ... on ExternalVideo { host }
        ... on Model3d { sources { url format mimeType filesize } }
      }
    }
  }
}`;

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
}

function extensionFromContentType(contentType, url) {
  const type = String(contentType ?? '').toLowerCase();
  if (type.includes('png')) return '.png';
  if (type.includes('webp')) return '.webp';
  if (type.includes('avif')) return '.avif';
  if (type.includes('gif')) return '.gif';
  if (type.includes('jpeg') || type.includes('jpg')) return '.jpg';
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (['.png', '.webp', '.avif', '.gif', '.jpeg', '.jpg'].includes(ext)) return ext === '.jpeg' ? '.jpg' : ext;
  } catch {}
  return '.img';
}

async function fetchWithRetry(url, options = {}, attempt = 0) {
  const response = await fetch(url, options);
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(12000, 750 * (2 ** attempt))));
    return fetchWithRetry(url, options, attempt + 1);
  }
  return response;
}

async function resolveProduct(handle) {
  const response = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: {'content-type': 'application/json', 'user-agent': 'product-twin-shopify-media-auditor/0.1'},
    body: JSON.stringify({query, variables: {handle}}),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`storefront ${response.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  if (json.errors?.length) throw new Error(json.errors.map((item) => item.message).join(' | '));
  return json.data?.product;
}

async function captureImage(image, directory, index, role, variantBindings) {
  const response = await fetchWithRetry(image.url, {headers: {'user-agent': 'product-twin-shopify-media-auditor/0.1'}});
  if (!response.ok) throw new Error(`image ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type');
  const filename = `${String(index).padStart(2, '0')}-${slug(role)}${extensionFromContentType(contentType, image.url)}`;
  await fs.writeFile(path.join(directory, filename), buffer);
  return {
    image_gid: image.id ?? null,
    role,
    width: image.width ?? null,
    height: image.height ?? null,
    megapixels: image.width && image.height ? Number(((image.width * image.height) / 1_000_000).toFixed(2)) : null,
    alt_text: image.altText ?? null,
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    variant_bindings: [...(variantBindings.get(image.id) ?? [])],
    runtime_filename: filename,
    source_url_persisted: false,
    binary_committed: false,
  };
}

function stableSource(source) {
  return {
    format: source.format ?? null,
    mime_type: source.mimeType ?? null,
    width: source.width ?? null,
    height: source.height ?? null,
    filesize: source.filesize ?? null,
    source_url_persisted: false,
  };
}

await fs.mkdir(runtimeRoot, {recursive: true});
const products = [];

for (const candidate of candidates) {
  console.log(`Auditing media: ${candidate.identity.vendor} ${candidate.identity.product_title}`);
  const directory = path.join(runtimeRoot, slug(candidate.candidate_id));
  await fs.mkdir(directory, {recursive: true});
  try {
    const product = await resolveProduct(candidate.identity.handle);
    if (!product) throw new Error('merchant product no longer resolves');

    const variantBindings = new Map();
    for (const variant of product.variants?.nodes ?? []) {
      if (!variant.image?.id) continue;
      const bindings = variantBindings.get(variant.image.id) ?? new Set();
      bindings.add(`${variant.title}${variant.sku ? ` (${variant.sku})` : ''}`);
      variantBindings.set(variant.image.id, bindings);
    }

    const uniqueImages = new Map();
    const mediaKinds = {};
    const nonImageMedia = [];
    for (const media of product.media?.nodes ?? []) {
      mediaKinds[media.mediaContentType] = (mediaKinds[media.mediaContentType] ?? 0) + 1;
      if (media.mediaContentType === 'IMAGE' && media.image?.id) {
        uniqueImages.set(media.image.id, {image: media.image, role: 'gallery-image', media_gid: media.id, media_alt: media.alt});
      } else {
        nonImageMedia.push({
          media_gid: media.id,
          media_type: media.mediaContentType,
          alt_text: media.alt ?? null,
          preview_image: media.previewImage ? {
            image_gid: media.previewImage.id ?? null,
            width: media.previewImage.width ?? null,
            height: media.previewImage.height ?? null,
            alt_text: media.previewImage.altText ?? null,
            source_url_persisted: false,
          } : null,
          host: media.host ?? null,
          sources: (media.sources ?? []).map(stableSource),
        });
      }
    }
    if (product.featuredImage?.id && !uniqueImages.has(product.featuredImage.id)) {
      uniqueImages.set(product.featuredImage.id, {image: product.featuredImage, role: 'featured-image', media_gid: null, media_alt: null});
    }
    for (const variant of product.variants?.nodes ?? []) {
      if (variant.image?.id && !uniqueImages.has(variant.image.id)) {
        uniqueImages.set(variant.image.id, {image: variant.image, role: 'variant-image', media_gid: null, media_alt: null});
      }
    }

    const images = [];
    let index = 1;
    for (const item of uniqueImages.values()) {
      try {
        const captured = await captureImage(item.image, directory, index, item.role, variantBindings);
        captured.media_gid = item.media_gid;
        captured.media_alt = item.media_alt ?? null;
        images.push(captured);
      } catch (error) {
        images.push({
          image_gid: item.image.id ?? null,
          role: item.role,
          width: item.image.width ?? null,
          height: item.image.height ?? null,
          alt_text: item.image.altText ?? null,
          capture_error: String(error?.message ?? error),
          source_url_persisted: false,
          binary_committed: false,
        });
      }
      index += 1;
    }

    const hashes = new Set(images.filter((image) => image.sha256).map((image) => image.sha256));
    products.push({
      candidate_id: candidate.candidate_id,
      category_id: candidate.category_id,
      room_role: candidate.room_role,
      identity: {
        merchant_product_gid: product.id,
        product_title: product.title,
        vendor: product.vendor,
        handle: product.handle,
      },
      status: 'LIVE_MEDIA_AUDITED',
      media_counts: mediaKinds,
      image_evidence: {
        gallery_and_variant_images_returned: images.length,
        images_downloaded_for_runtime_audit: images.filter((image) => image.sha256).length,
        unique_binary_images: hashes.size,
        reconstruction_resolution_images: images.filter((image) => (image.width ?? 0) >= 1000 && (image.height ?? 0) >= 1000).length,
        images_1600px_or_larger: images.filter((image) => (image.width ?? 0) >= 1600 || (image.height ?? 0) >= 1600).length,
        images_with_variant_binding: images.filter((image) => (image.variant_bindings?.length ?? 0) > 0).length,
        images,
      },
      non_image_media: nonImageMedia,
      reconstruction_assessment: {
        view_classification_state: 'CONTACT_SHEET_VISUAL_REVIEW_REQUIRED',
        material_binding_state: images.some((image) => (image.variant_bindings?.length ?? 0) > 0) ? 'SOME_VARIANT_IMAGE_BINDING_PRESENT' : 'NO_VARIANT_IMAGE_BINDING_IN_STOREFRONT_MEDIA',
        public_texture_reuse_rights: 'REVIEW',
        disclosure: 'Gallery imagery may support evidence-led reconstruction and QA. It is not automatically licensed for texture extraction, public rendering, redistribution or exact selected-variant claims.',
      },
    });
  } catch (error) {
    products.push({
      candidate_id: candidate.candidate_id,
      identity: candidate.identity,
      status: 'LIVE_MEDIA_AUDIT_FAILED',
      error: String(error?.message ?? error),
    });
  }
}

const successful = products.filter((product) => product.status === 'LIVE_MEDIA_AUDITED');
const summary = {
  generated_at: generatedAt,
  products_attempted: products.length,
  products_audited: successful.length,
  products_failed: products.length - successful.length,
  gallery_images_returned: successful.reduce((sum, product) => sum + product.image_evidence.gallery_and_variant_images_returned, 0),
  unique_binary_images: successful.reduce((sum, product) => sum + product.image_evidence.unique_binary_images, 0),
  reconstruction_resolution_images: successful.reduce((sum, product) => sum + product.image_evidence.reconstruction_resolution_images, 0),
  images_1600px_or_larger: successful.reduce((sum, product) => sum + product.image_evidence.images_1600px_or_larger, 0),
  images_with_variant_binding: successful.reduce((sum, product) => sum + product.image_evidence.images_with_variant_binding, 0),
  native_model3d_media: successful.reduce((sum, product) => sum + (product.media_counts.MODEL_3D ?? 0), 0),
  video_media: successful.reduce((sum, product) => sum + (product.media_counts.VIDEO ?? 0), 0),
  external_video_media: successful.reduce((sum, product) => sum + (product.media_counts.EXTERNAL_VIDEO ?? 0), 0),
  persistence_policy: 'Source URLs and image binaries are not committed. Stable IDs, dimensions, hashes, media counts and variant bindings are persisted; downloaded files remain only under gitignored runtime for visual QA.',
};

await fs.writeFile(outputPath, `${JSON.stringify({summary, products}, null, 2)}\n`);
console.log(JSON.stringify({
  summary,
  products: successful.map((product) => ({
    candidate_id: product.candidate_id,
    title: product.identity.product_title,
    vendor: product.identity.vendor,
    media_counts: product.media_counts,
    images: product.image_evidence.gallery_and_variant_images_returned,
    unique_images: product.image_evidence.unique_binary_images,
    reconstruction_resolution_images: product.image_evidence.reconstruction_resolution_images,
    images_1600px_or_larger: product.image_evidence.images_1600px_or_larger,
    variant_bound_images: product.image_evidence.images_with_variant_binding,
  })),
}, null, 2));
