import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, ArrowRight } from "lucide-react";

interface PostCardProps {
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt?: string | Date | null;
}

export function PostCard({ title, slug, excerpt, publishedAt }: PostCardProps) {
  return (
    <Link
      href={`/news/${slug}`}
      className="group focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded-xl block"
    >
      <Card className="h-full transition-all duration-200 group-hover:shadow-md group-hover:border-[#0077B6]/30 group-hover:-translate-y-0.5">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            {publishedAt && (
              <>
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                <time dateTime={new Date(publishedAt).toISOString()}>
                  {format(new Date(publishedAt), "MMMM d, yyyy")}
                </time>
              </>
            )}
          </div>
          <CardTitle className="font-[family-name:var(--font-oswald)] text-lg text-[#005f8f] uppercase tracking-wide group-hover:text-[#003f5f] transition-colors">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {excerpt && (
            <p className="text-sm text-[#495057] leading-relaxed line-clamp-3">
              {excerpt}
            </p>
          )}
          <span className="inline-flex items-center gap-1 text-sm font-medium text-[#0077B6] mt-3 group-hover:gap-2 transition-all">
            Read more
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
