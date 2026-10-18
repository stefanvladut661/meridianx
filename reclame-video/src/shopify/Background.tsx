import React from "react";
import { AbsoluteFill } from "remotion";
import { SHOP } from "../theme";

// Fundalul Shopify: o culoare plină, cu o vignetă blândă. Fără grăunte de
// film: animat nu se comprimă (un clip ajungea la sute de MB), iar
// platformele l-ar strica oricum la reencodare.

export const ShopifyBackground: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: SHOP.bg }}>
      <AbsoluteFill style={{ background: "radial-gradient(110% 75% at 50% 42%, rgba(255,255,255,0.035) 0%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.38) 100%)" }} />
    </AbsoluteFill>
  );
};
