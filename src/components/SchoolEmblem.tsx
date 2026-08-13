/**
 * شعار المدرسة — نجمة سدو ثمانية ذهبية داخل حلقة عنّابية.
 * عنصر هوية مشترك بين الشريط الجانبي والترويسة.
 */
export default function SchoolEmblem({ className = "size-11" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={
        "grid shrink-0 place-items-center rounded-full border-2 border-gold/90 bg-maroon-deep shadow-[inset_0_1px_4px_rgba(0,0,0,.35)] " +
        className
      }
    >
      <svg viewBox="0 0 24 24" className="size-[60%] fill-gold" aria-hidden>
        <path d="M12 1.5 14.6 7l5.9-1.5L17 10.4l4.5 4-6-.4-1 5.9-2.5-5.5-5.4 2.7 2.7-5.4L3.8 9.2l6 .3L11 3.6Z" opacity=".35" />
        <path d="M12 3.5 13.9 9l5.6.2-4.4 3.4 1.6 5.4L12 14.8 7.3 18l1.6-5.4L4.5 9.2 10.1 9Z" />
        <circle cx="12" cy="11.6" r="1.7" className="fill-maroon-deep" />
      </svg>
    </div>
  );
}
