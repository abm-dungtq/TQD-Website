import type { APIRoute } from 'astro';
import { sections, type SectionId } from '../data/profile';
import { markdownResponse, sectionMarkdown } from '../lib/profile-markdown';

export function getStaticPaths() {
  return sections.map((s) => ({ params: { section: s.id }, props: { id: s.id } }));
}

export const GET: APIRoute<{ id: SectionId }> = ({ props }) => markdownResponse(sectionMarkdown(props.id));
