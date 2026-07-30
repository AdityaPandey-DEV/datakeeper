import { FileBrowser } from '@/components/FileBrowser';

interface BrowsePageProps {
  params: Promise<{ path: string[] }>;
}

export default async function BrowsePage({ params }: BrowsePageProps) {
  const { path } = await params;
  const fullPath = path ? path.map(decodeURIComponent).join('/') : '';

  return <FileBrowser initialPath={fullPath} />;
}

export async function generateMetadata({ params }: BrowsePageProps) {
  const { path } = await params;
  const fullPath = path ? path.map(decodeURIComponent).join('/') : '';
  const folderName = path ? decodeURIComponent(path[path.length - 1]) : 'Root';

  return {
    title: `${folderName} — DataKeeper`,
    description: `Browse files in ${fullPath || 'root'} folder`,
  };
}
