import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { publicResourceDownloadUrl } from "@/features/public-resources/api";
import { PublicResource, ResourceType } from "@/types";
import { Download, FileText, MapPin, SchoolIcon, Video } from "lucide-react";


function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function formatSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}


const TYPE_LABELS: Record<ResourceType, string> = {
  DOCUMENT: "Document",
  VIDEO: "Vidéo",
};

export default function ResourceCard({ resource }: { resource: PublicResource }) {
  const embedUrl =
    resource.type === "VIDEO" && resource.videoUrl
      ? toEmbedUrl(resource.videoUrl)
      : null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{resource.title}</CardTitle>
          <Badge
            variant={resource.type === "DOCUMENT" ? "default" : "secondary"}
            className="shrink-0"
          >
            {resource.type === "DOCUMENT" ? (
              <FileText className="mr-1 size-3" />
            ) : (
              <Video className="mr-1 size-3" />
            )}
            {TYPE_LABELS[resource.type]}
          </Badge>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <SchoolIcon className="size-3" />
          {resource.school.name}
          {resource.school.island && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {resource.school.island}
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {resource.description && (
          <p className="text-sm text-muted-foreground">
            {resource.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1">
          {resource.classes.map((c) => (
            <Badge key={c.classe.id} variant="outline" className="text-xs">
              {c.classe.name}
            </Badge>
          ))}
          {resource.subjects.map((s) => (
            <Badge key={s.subject.id} variant="outline" className="text-xs">
              {s.subject.name}
            </Badge>
          ))}
        </div>

        <div className="mt-auto pt-2">
          {resource.type === "DOCUMENT" ? (
            <Button asChild size="sm" className="w-full">
              <a href={publicResourceDownloadUrl(resource.id)}>
                <Download className="mr-2 size-4" />
                Télécharger
                {resource.fileSize ? ` (${formatSize(resource.fileSize)})` : ""}
              </a>
            </Button>
          ) : embedUrl ? (
            <div className="aspect-video overflow-hidden rounded-md border">
              <iframe
                src={embedUrl}
                title={resource.title}
                className="size-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            resource.videoUrl && (
              <Button asChild size="sm" variant="outline" className="w-full">
                <a href={resource.videoUrl} target="_blank" rel="noreferrer">
                  <Video className="mr-2 size-4" />
                  Voir la vidéo
                </a>
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}