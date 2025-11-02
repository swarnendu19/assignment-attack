"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { data: session, isPending } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (!isPending && !session) {
            router.push("/login");
        }
    }, [session, isPending, router]);

    if (isPending) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!session) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center space-x-8">
                            <h1 className="text-xl font-semibold text-gray-900">
                                Unified Inbox
                            </h1>
                            <nav className="flex space-x-4">
                                <a
                                    href="/inbox"
                                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                                >
                                    Inbox
                                </a>
                                {(session.user as any)?.role === "ADMIN" && (
                                    <a
                                        href="/admin"
                                        className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                                    >
                                        Admin
                                    </a>
                                )}
                            </nav>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-700">
                                Welcome, {session.user.name || session.user.email}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                {(session.user as any).role || "EDITOR"}
                            </span>
                            <button
                                onClick={async () => {
                                    try {
                                        const { signOut } = await import("@/lib/auth-client");
                                        await signOut();
                                        router.push("/login");
                                    } catch (error) {
                                        console.error("Sign out error:", error);
                                        router.push("/login");
                                    }
                                }}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
            <main>{children}</main>
        </div>
    );
}