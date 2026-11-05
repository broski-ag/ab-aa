/**
 * Everything editable about the portfolio content lives here.
 *
 * `thumb` is the number of the file in /public/thumbnails (1.jpg … 22.jpg).
 *
 * `preview` (optional) is a small, fast-starting clip used for the in-grid autoplay
 * instead of the full file — this is how YouTube / Instagram keep a grid light. If it is
 * left out the full video is used. See scripts/make-previews.sh for how to generate them.
 */
export interface VideoItem {
  src: string;
  thumb: number;
  preview?: string;
}

const CDN = 'https://cdn.jsdelivr.net/gh/Aamirnaqvi-mal/Videos@main/Portfolio';

export const showreel: VideoItem = {
  src: `${CDN}/long/2,5,6,8,9/1.mp4`,
  thumb: 1,
};

export const featuredVideos: VideoItem[] = [
  `${CDN}/long/1.mp4`,
  `${CDN}/long/2%2C5%2C6%2C8%2C9/2.webm`,
  `${CDN}/long/3.mp4`,
  `${CDN}/long/4.mp4`,
  `${CDN}/long/2%2C5%2C6%2C8%2C9/5.webm`,
  `${CDN}/long/2%2C5%2C6%2C8%2C9/6.mp4`,
  `${CDN}/long/7.webm`,
  `${CDN}/long/2%2C5%2C6%2C8%2C9/8.webm`,
  `${CDN}/long/2%2C5%2C6%2C8%2C9/9.webm`,
].map((src, i) => ({ src, thumb: i + 2 }));

export const socialVideos: VideoItem[] = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  const ext = [5, 8, 10].includes(n) ? 'mp4' : 'webm';
  return { src: `${CDN}/reels/${n}.${ext}`, thumb: n + 10 };
});

export const stats = [
  { value: '3+', label: 'Years Experience' },
  { value: '99+', label: 'Projects Delivered' },
  { value: '12', label: 'Social Formats' },
  { value: '20+', label: 'Happy Clients' },
];

export const skills = [
  'Motion Design',
  'Brand Films',
  'Social Content',
  'Visual Identity',
  'Art Direction',
  'Storytelling',
];
