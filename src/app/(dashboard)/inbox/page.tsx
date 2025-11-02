"use client";

import { useSession } from "@/lib/auth-client";

export default function InboxPage() {
    const { data: session } = useSession();

    return (
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Welcome to your Unified Inbox!
                        </h2>
                        <p className="text-gray-600 mb-2">
                            You are successfully authenticated as: {session?.user.email}
                        </p>
                        <p className="text-gray-600">
                            Role: {session?.user.role}
                        </p>
                        <div className="mt-6 text-sm text-gray-500">
                            This is a placeholder for the inbox interface.
                            <br />
                            The message management system will be implemented in future tasks.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}