export default function Loading({ className }: { className?: string }) {
    return (
        <span className={className}>
            <i className="icon-[mdi--loading] block size-6 animate-spin" />
        </span>
    );
}
