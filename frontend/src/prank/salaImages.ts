export const SALA_IMAGES: string[] = [
  '1581ee59f5f51de8544357062e9ada1f.jpg',
  '6769d44ebe180.jpeg',
  '723e1c59ca444cd0bf66f51964784af6.jpg',
  'ddcddde2e045a47c010a34feac72d286.jpg',
  'EDZwIsMU0AArmON.webp',
  'images (1).jpg',
  'images (10).jpg',
  'images (11).jpg',
  'images (12).jpg',
  'images (13).jpg',
  'images (2).jpg',
  'images (3).jpg',
  'images (4).jpg',
  'images (5).jpg',
  'images (6).jpg',
  'images (7).jpg',
  'images (8).jpg',
  'images (9).jpg',
  'images.jpg',
  'male.jpg',
  'sala.png',
]

export function salaUrl(file: string): string {
  return '/sala/' + encodeURIComponent(file)
}

export const SENAR_IMAGES: string[] = [
  '1 (1).png',
  '1 (2).png',
  '1 (3).png',
  '1 (4).png',
  '1 (5).png',
  '1 (6).png',
  '1 (7).png',
  '1 (8).png',
  '1 (9).png',
  '1 (10).png',
  '1 (11).png',
  '1 (12).png',
  '1 (13).png',
]

export function senarUrl(file: string): string {
  return '/senar/' + encodeURIComponent(file)
}
