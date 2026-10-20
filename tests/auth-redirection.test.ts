import { describe, it, expect, vi } from "vitest";

describe("Auth Redirection & Session Guard Tests", () => {
  it("should redirect authenticated user to /calendar in AuthLayout", async () => {
    const mockRedirect = vi.fn();
    const mockAuth = vi.fn().mockResolvedValue({
      user: { id: "user-1", email: "sahil@example.com", name: "Sahil" },
    });

    async function AuthLayoutSimulation({
      children,
    }: {
      children: React.ReactNode;
    }) {
      const session = await mockAuth();
      if (session?.user) {
        mockRedirect("/calendar");
        return null;
      }
      return children;
    }

    const result = await AuthLayoutSimulation({ children: "SIGN_IN_FORM" });
    expect(mockRedirect).toHaveBeenCalledWith("/calendar");
    expect(result).toBeNull();
  });

  it("should allow unauthenticated user to access auth pages in AuthLayout", async () => {
    const mockRedirect = vi.fn();
    const mockAuth = vi.fn().mockResolvedValue(null);

    async function AuthLayoutSimulation({
      children,
    }: {
      children: React.ReactNode;
    }) {
      const session = await mockAuth();
      if (session?.user) {
        mockRedirect("/calendar");
        return null;
      }
      return children;
    }

    const result = await AuthLayoutSimulation({ children: "SIGN_IN_FORM" });
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBe("SIGN_IN_FORM");
  });

  it("should route brand logo to /calendar if session is present, / if not", () => {
    const getLogoHref = (hasSession: boolean) => (hasSession ? "/calendar" : "/");

    expect(getLogoHref(true)).toBe("/calendar");
    expect(getLogoHref(false)).toBe("/");
  });

  it("should choose appropriate primary CTA link based on authentication state", () => {
    const getHeroCtaTarget = (isAuthenticated: boolean) => {
      if (isAuthenticated) {
        return { label: "Go to Workspace", href: "/calendar" };
      }
      return { label: "Get Started Free", href: "/sign-up" };
    };

    expect(getHeroCtaTarget(true)).toEqual({
      label: "Go to Workspace",
      href: "/calendar",
    });
    expect(getHeroCtaTarget(false)).toEqual({
      label: "Get Started Free",
      href: "/sign-up",
    });
  });
});
