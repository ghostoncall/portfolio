import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { listMedia, uploadMedia, deleteMedia } from "@/lib/server-fns";
import { Media } from "@/components/media";

export const Route = createFileRoute("/onlyme/media")({
  component: MediaLibrary,
});

function MediaLibrary() {
  const [assets, setAssets] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const data = await listMedia();
      setAssets(data);
    } catch (e) {
      setError("Failed to load media assets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setProgress(0);
      
      // Since uploadMedia is a server function, we don't have direct access to 
      // XHR progress events. We'll simulate a progress bar or just show "Uploading...".
      // For better UX in a real app, we'd use a custom fetch/XHR.
      // Here we'll simulate steps.
      const interval = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + 10 : prev));
      }, 200);

      const formData = new FormData();
      formData.append("file", file);
      
      await uploadMedia(formData);
      
      clearInterval(interval);
      setProgress(100);
      await loadAssets();
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this asset?")) return;
    try {
      await deleteMedia(id);
      await loadAssets();
    } catch (e) {
      setError("Failed to delete asset");
    }
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading && assets.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="font-serif italic text-muted-foreground">Loading archives...</span>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold font-serif text-foreground">Media Library</h2>
          <p className="text-sm text-muted-foreground font-sans">
            Manage all uploaded assets for the portfolio.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Filter assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-border bg-transparent py-2 pl-3 pr-10 text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
              Search
            </span>
          </div>
          
          <label className="cursor-pointer border border-foreground px-4 py-2 text-xs font-sans uppercase tracking-widest text-foreground transition-colors hover:bg-foreground hover:text-background">
            {uploading ? "Uploading..." : "Upload"}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </header>

      {uploading && (
        <div className="relative h-1 w-full overflow-hidden bg-muted">
          <div 
            className="h-full bg-foreground transition-all duration-300" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      )}

      {error && (
        <div className="border border-destructive bg-destructive/10 p-4 text-xs text-destructive">
          {error}
          <button 
            onClick={() => setError(null)} 
            className="ml-4 underline uppercase tracking-widest"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredAssets.map((asset) => (
          <div key={asset.id} className="bg-background p-4 group">
            <div className="relative mb-3 border border-border overflow-hidden">
              <Media 
                items={[{ src: asset.url, title: asset.name }]} 
                ratio="1/1" 
                fit="cover" 
                className="my-0"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-serif text-foreground" title={asset.name}>
                {asset.name}
              </span>
              <button
                onClick={() => handleDelete(asset.id)}
                className="text-[10px] font-sans uppercase tracking-tighter text-muted-foreground transition-colors hover:text-destructive"
              >
                Delete
              </button>
            </div>
            <div className="mt-1 flex justify-between text-[9px] font-sans uppercase tracking-wider text-muted-foreground/60">
              <span>{asset.type.split('/')[1]}</span>
              <span>{(asset.size / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        ))}
        {filteredAssets.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <p className="font-serif italic text-muted-foreground">No assets found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
