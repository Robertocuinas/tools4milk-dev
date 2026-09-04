type LoadingRowsProps = {
  count?: number;
  height?: string;
};

export function LoadingRows({ count = 4, height = "h-20" }: LoadingRowsProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${height} animate-pulse rounded-[14px] bg-app-surface2`} />
      ))}
    </div>
  );
}

export function LoadingGrid({ count = 6, height = "h-28" }: LoadingRowsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${height} animate-pulse rounded-[14px] bg-app-surface2`} />
      ))}
    </div>
  );
}
