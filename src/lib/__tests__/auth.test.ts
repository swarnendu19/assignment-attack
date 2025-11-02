import { hasRole, requireRole } from "../auth";

describe("Authentication Helpers", () => {
    describe("hasRole", () => {
        it("should return false for null user", () => {
            expect(hasRole(null, "VIEWER")).toBe(false);
        });

        it("should return true for exact role match", () => {
            const user = { id: "1", email: "test@example.com", role: "EDITOR" } as any;
            expect(hasRole(user, "EDITOR")).toBe(true);
        });

        it("should return true for higher role", () => {
            const user = { id: "1", email: "test@example.com", role: "ADMIN" } as any;
            expect(hasRole(user, "EDITOR")).toBe(true);
            expect(hasRole(user, "VIEWER")).toBe(true);
        });

        it("should return false for lower role", () => {
            const user = { id: "1", email: "test@example.com", role: "VIEWER" } as any;
            expect(hasRole(user, "EDITOR")).toBe(false);
            expect(hasRole(user, "ADMIN")).toBe(false);
        });

        it("should default to VIEWER for undefined role", () => {
            const user = { id: "1", email: "test@example.com" } as any;
            expect(hasRole(user, "VIEWER")).toBe(true);
            expect(hasRole(user, "EDITOR")).toBe(false);
        });
    });

    describe("requireRole", () => {
        it("should throw error for null user", () => {
            expect(() => requireRole(null, "VIEWER")).toThrow("Access denied. Required role: VIEWER");
        });

        it("should not throw for sufficient role", () => {
            const user = { id: "1", email: "test@example.com", role: "ADMIN" } as any;
            expect(() => requireRole(user, "EDITOR")).not.toThrow();
        });

        it("should throw for insufficient role", () => {
            const user = { id: "1", email: "test@example.com", role: "VIEWER" } as any;
            expect(() => requireRole(user, "ADMIN")).toThrow("Access denied. Required role: ADMIN");
        });
    });
});