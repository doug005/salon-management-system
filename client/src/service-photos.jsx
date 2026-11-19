import { mediaUrl } from "./api.js";

export function findServiceInspiration(service) {
  return service?.imageUrl ? null : undefined;
}

export function ServicePhoto({ service }) {
  if (service?.imageUrl) return <img src={mediaUrl(service.imageUrl)} alt={service.name} loading="lazy" decoding="async" />;
  return null;
}
