import Image from "next/image";

type BrandMarkProps = {
  size: 44 | 48 | 64 | 72;
};

export function BrandMark({ size }: BrandMarkProps) {
  return (
    <Image
      alt="Joint logo"
      className="shrink-0 rounded-2xl"
      height={size}
      priority
      sizes={`${size}px`}
      src="/brand/joint-logo.png"
      width={size}
    />
  );
}
