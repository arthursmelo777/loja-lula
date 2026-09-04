"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackMetaEvent } from "@/lib/meta-pixel-client";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/** Base do Pixel do Meta + PageView em toda troca de rota (navegação client-side do App Router). */
export function MetaPixel() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // O próprio script base já dispara o primeiro PageView ao carregar —
    // aqui só cobrimos as trocas de rota subsequentes (navegação client-side).
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    trackMetaEvent("PageView");
  }, [pathname]);

  if (!PIXEL_ID) return null;

  return (
    <>
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${PIXEL_ID}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element -- exigido pelo pixel do Meta, next/image não serve aqui */}
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
