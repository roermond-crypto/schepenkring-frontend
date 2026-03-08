import { ReactNode } from "react";

export default function WidgetLayout({ children }: { children: ReactNode }) {
    return (
        <div className="h-full w-full bg-transparent overflow-hidden">
            {children}
        </div>
    );
}
