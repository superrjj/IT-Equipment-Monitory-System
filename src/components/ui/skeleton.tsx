import React from "react";

/** Inline once per view that uses `<Skeleton />` (matches admin dashboard shimmer). */
export const ShimmerKeyframes: React.FC = () => (
  <style>{`
    @keyframes skShimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
  `}</style>
);

export type SkeletonProps = {
  width?: string | number;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
};

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 14,
  radius = 6,
  style = {},
}) => (
  <div
    style={{
      width,
      height,
      borderRadius: radius,
      background:
        "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",
      backgroundSize: "200% 100%",
      animation: "skShimmer 1.4s ease infinite",
      flexShrink: 0,
      ...style,
    }}
  />
);
