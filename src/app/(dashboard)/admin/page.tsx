"use client";

import { useSession } from "@/lib/auth-client";
import { useEffect, useState } from "react";

interface User {
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: string;
    updatedAt: string;
}

export default function AdminPage() {
    const { data: session } = useSession();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await fetch("/api/admin/users");
                if (response.ok) {
                    const data = await response.json();
                    setUsers(data.users);
                } else {
                    const errorData = await response.json();
                    setError(errorData.error || "Failed to fetch users");
                }
            } catch (err) {
                setError("Network error occurred");
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    const userRole = (session?.user as any)?.role || "VIEWER";

    if (userRole !== "ADMIN") {
        return (
            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <div className="border-4 border-dashed border-red-200 rounded-lg h-96 flex items-center justify-center">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-red-900 mb-4">
                                Access Denied
                            </h2>
                            <p className="text-red-600">
                                You need ADMIN role to access this page. Your current role: {userRole}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                    <p className="text-gray-600 mt-2">Manage users and system settings</p>
                </div>

                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <div className="px-4 py-5 sm:p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">User Management</h2>

                        {loading && (
                            <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        )}

                        {error && (
                            <div className="rounded-md bg-red-50 p-4 mb-4">
                                <div className="text-sm text-red-700">{error}</div>
                            </div>
                        )}

                        {!loading && !error && (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                User
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Role
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Created
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {users.map((user) => (
                                            <tr key={user.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {user.name || "No name"}
                                                        </div>
                                                        <div className="text-sm text-gray-500">{user.email}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.role === "ADMIN"
                                                            ? "bg-red-100 text-red-800"
                                                            : user.role === "EDITOR"
                                                                ? "bg-blue-100 text-blue-800"
                                                                : "bg-gray-100 text-gray-800"
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(user.createdAt).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}