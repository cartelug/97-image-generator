import type { Quality } from "./types";

export type Preset = {
  id: string;
  name: string;
  icon: "poster" | "ad" | "product" | "portrait" | "social" | "cinema";
  blurb: string;
  aspect: string;
  quality: Quality;
  starter: string; // fills an empty prompt (editable)
  direction: string; // appended when the prompt already has text
};

export const PRESETS: Preset[] = [
  {
    id: "poster",
    name: "Poster",
    icon: "poster",
    blurb: "Event & campaign posters",
    aspect: "2:3",
    quality: "high",
    starter:
      'A bold, modern event poster. Large central headline reading "YOUR HEADLINE" in a refined sans-serif, a clear subhead, and a details line at the bottom. Striking focal visual of [describe subject], dramatic lighting, rich contrast, generous margins.',
    direction:
      "Poster layout: strong typographic hierarchy, clean grid, balanced negative space, crisp perfectly spelled text, print-ready finish.",
  },
  {
    id: "advertising",
    name: "Advertising",
    icon: "ad",
    blurb: "Campaign-ready ad visuals",
    aspect: "4:5",
    quality: "high",
    starter:
      "A premium advertising visual for [brand / product]. Hero product in the foreground, an aspirational lifestyle setting behind it, one short bold headline, and clear space for a call to action. Polished commercial lighting, confident colour palette.",
    direction:
      "Advertising composition: clear focal point, headline-safe negative space, premium commercial lighting, cohesive brand colour palette, high production value.",
  },
  {
    id: "product",
    name: "Product",
    icon: "product",
    blurb: "Studio product photography",
    aspect: "1:1",
    quality: "high",
    starter:
      "Studio product photograph of [product] on a [surface] against a soft seamless backdrop. Large softbox lighting with gentle gradient shadows, 85mm lens, shallow depth of field, true-to-life materials, subtle reflections, clean premium e-commerce look.",
    direction:
      "Product photography: softbox lighting, true-to-life materials and reflections, crisp edges, shallow depth of field, no distortion of the product.",
  },
  {
    id: "portrait",
    name: "Portrait",
    icon: "portrait",
    blurb: "Photoreal people & headshots",
    aspect: "4:5",
    quality: "high",
    starter:
      "Editorial portrait of [describe person], natural skin texture with visible pores, soft window light from camera left, 85mm f/1.8, shallow depth of field, calm confident expression, neutral muted background, film-like colour grading.",
    direction:
      "Photoreal portrait: natural skin texture, believable anatomy and hands, soft directional light, 85mm lens look, authentic expression.",
  },
  {
    id: "social",
    name: "Social",
    icon: "social",
    blurb: "Scroll-stopping graphics",
    aspect: "9:16",
    quality: "high",
    starter:
      'Scroll-stopping social media graphic. Bold short headline "YOUR MESSAGE" in large clean type, vibrant but cohesive colours, one strong focal visual of [subject], tidy layout with safe margins for platform UI.',
    direction:
      "Social graphic: bold legible type, high contrast, safe margins for platform UI, one clear focal point, instantly readable on a phone.",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    icon: "cinema",
    blurb: "Film-still visuals",
    aspect: "16:9",
    quality: "high",
    starter:
      "Cinematic film still of [scene]. Anamorphic 35mm look, motivated practical lighting, atmospheric haze, deep shadows with rich highlights, shallow depth of field, subtle film grain, teal-and-amber colour grade, epic but grounded composition.",
    direction:
      "Cinematic look: anamorphic framing, motivated lighting, atmospheric depth, subtle film grain, deliberate colour grade, strong sense of scale.",
  },
];

export const PRESERVE_TEXT =
  "Edit only what is described above. Preserve everything else exactly as in the reference image: same subject, composition, framing, lighting, colours, text, logos and proportions.";
