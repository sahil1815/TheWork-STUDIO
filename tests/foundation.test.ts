import { describe, it, expect } from "vitest";
import { Role, TaskStatus, InvitationStatus, ProposalStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

describe("Phase 0 Foundation Tests", () => {
  it("should have correct RFC 2119 naming and Role enum constants", () => {
    expect(Role.OWNER).toBe("OWNER");
    expect(Role.ADMIN).toBe("ADMIN");
    expect(Role.MEMBER).toBe("MEMBER");
    expect(Role.GUEST).toBe("GUEST");

    expect(TaskStatus.TODO).toBe("TODO");
    expect(TaskStatus.IN_PROGRESS).toBe("IN_PROGRESS");
    expect(TaskStatus.DONE).toBe("DONE");
    expect(TaskStatus.CANCELLED).toBe("CANCELLED");

    expect(InvitationStatus.PENDING_APPROVAL).toBe("PENDING_APPROVAL");
    expect(ProposalStatus.PENDING).toBe("PENDING");
  });

  it("should validate FR-05 timing rules correctly", () => {
    const validateTiming = (startTime?: string | null, endTime?: string | null) => {
      if (!startTime && !endTime) return { valid: true, type: "ALL_DAY" };
      if (startTime && !endTime) return { valid: true, type: "TIMED_START_ONLY" };
      if (!startTime && endTime) return { valid: false, error: "endTime without startTime is invalid" };
      if (startTime && endTime) {
        if (endTime <= startTime) {
          return { valid: false, error: "endTime must be after startTime" };
        }
        return { valid: true, type: "TIMED_RANGE" };
      }
      return { valid: false, error: "Unknown timing configuration" };
    };

    // All day
    expect(validateTiming(null, null)).toEqual({ valid: true, type: "ALL_DAY" });
    // Timed start only
    expect(validateTiming("09:00", null)).toEqual({ valid: true, type: "TIMED_START_ONLY" });
    // Timed range valid
    expect(validateTiming("09:00", "10:30")).toEqual({ valid: true, type: "TIMED_RANGE" });
    // End time without start time (invalid)
    expect(validateTiming(null, "11:00").valid).toBe(false);
    // End time before start time (invalid)
    expect(validateTiming("14:00", "13:00").valid).toBe(false);
    // End time equal to start time (invalid)
    expect(validateTiming("14:00", "14:00").valid).toBe(false);
  });

  it("should validate and resolve IANA timezones (FR-02)", () => {
    const isValidIANATimezone = (tz: string) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    };

    expect(isValidIANATimezone("Asia/Dhaka")).toBe(true);
    expect(isValidIANATimezone("America/New_York")).toBe(true);
    expect(isValidIANATimezone("Europe/London")).toBe(true);
    expect(isValidIANATimezone("UTC")).toBe(true);
    expect(isValidIANATimezone("Invalid/Unknown_Timezone_123")).toBe(false);
  });

  it("should securely hash and verify passwords using bcryptjs (NFR-01)", async () => {
    const rawPassword = "password123";
    const hash = await bcrypt.hash(rawPassword, 10);
    expect(hash).not.toBe(rawPassword);

    const matches = await bcrypt.compare(rawPassword, hash);
    expect(matches).toBe(true);

    const wrongMatches = await bcrypt.compare("wrongpass", hash);
    expect(wrongMatches).toBe(false);
  });
});
