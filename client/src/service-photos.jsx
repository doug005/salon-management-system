import { mediaUrl } from "./api.js";

const photos = [
  {
    match: /cornrow|braid|plait/i,
    src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/Fine_Braids%2C_Dimma_%2813307706094%29.jpg/640px-Fine_Braids%2C_Dimma_%2813307706094%29.jpg",
    alt: "Example of fine cornrow braids; illustrative reference, not a local professional portfolio",
    credit: "Rod Waddington · CC BY-SA 2.0",
    page: "https://commons.wikimedia.org/wiki/File:Fine_Braids,_Dimma_(13307706094).jpg",
  },
  {
    match: /make.?up|cosmetic/i,
    src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/Make-up_artist.jpg/640px-Make-up_artist.jpg",
    alt: "Makeup artist applying makeup backstage; illustrative reference, not a local professional portfolio",
    credit: "Charlie Brewer · CC BY-SA 2.0",
    page: "https://commons.wikimedia.org/wiki/File:Make-up_artist.jpg",
  },
  {
    match: /nail|manicure|pedicure/i,
    src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3b/French_Manicure_with_Glitter_nail_art_on_ring_finger.jpg/640px-French_Manicure_with_Glitter_nail_art_on_ring_finger.jpg",
    alt: "French manicure with glitter nail art; illustrative reference, not a local professional portfolio",
    credit: "Theknowhau · CC BY-SA 4.0",
    page: "https://commons.wikimedia.org/wiki/File:French_Manicure_with_Glitter_nail_art_on_ring_finger.jpg",
  },
  {
    match: /hair oil|hair treatment|treatment|condition|hair care/i,
    src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/Hair_Oil_Treatment_at_Hair_Salon.jpg/640px-Hair_Oil_Treatment_at_Hair_Salon.jpg",
    alt: "Hair oil treatment being applied; illustrative reference, not a local professional portfolio",
    credit: "geehairimages · CC BY 2.0",
    page: "https://commons.wikimedia.org/wiki/File:Hair_Oil_Treatment_at_Hair_Salon.jpg",
  },
];

export function findServiceInspiration(service) {
  if (service?.imageUrl) return null;
  return photos.find(({ match }) => match.test(`${service?.name || ""} ${service?.description || ""}`)) || null;
}

export function ServicePhoto({ service }) {
  const photo = findServiceInspiration(service);
  if (service?.imageUrl) return <img src={mediaUrl(service.imageUrl)} alt={service.name} loading="lazy" decoding="async" />;
  if (!photo) return null;
  return <>
    <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
    <span className="service-photo-credit">
      <span>Illustrative reference · not this professional’s portfolio</span>
      <span>{photo.credit}</span>
    </span>
  </>;
}
