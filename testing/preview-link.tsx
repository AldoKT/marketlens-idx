import { forwardRef, type ComponentPropsWithoutRef } from "react";

// Only the standalone webpack preview aliases next/link here. Production keeps Next Link.
const PreviewLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<"a"> & { prefetch?: boolean }>(
    ({ prefetch, ...props }, ref) => {
        void prefetch; // A plain anchor never prefetches Next routes or needs Next runtime flags.
        return <a {...props} ref={ref} />;
    },
);
PreviewLink.displayName = "PreviewLink";
export default PreviewLink;
