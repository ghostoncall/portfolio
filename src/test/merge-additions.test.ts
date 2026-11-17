/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures */
import { describe, expect, it } from "vitest";
import { mergePage } from "@/lib/merge-additions";

describe("mergePage – additions never duplicate existing entries", () => {
  it("matches the B.Tech degree by meaning, not just id, and only fills empty fields", () => {
    const fromDb = {
      kind: "education",
      entries: [
        {
          id: "f3a1c9-admin-generated",
          degree: "Bachelor of Technology",
          institution: "Bharati Vidyapeeth's College of Engineering (BVCOE), New Delhi",
          status: "Graduated",
          cgpa: "7.95/10.0",
          coursework: [{ category: "Core", courses: ["Signals"] }],
          sort: 0,
        },
        {
          id: "school",
          degree: "Senior Secondary Education (12th grade)",
          institution: "Sachdeva Public School, Pitampura",
          coursework: [],
          sort: 1,
        },
      ],
    };

    const merged = mergePage("education", fromDb);
    const btech = merged.entries.filter((e: any) => /bachelor of technology/i.test(e.degree));

    expect(btech).toHaveLength(1);
    // The admin's entry wins …
    expect(btech[0].id).toBe("f3a1c9-admin-generated");
    expect(btech[0].status).toBe("Graduated");
    expect(btech[0].cgpa).toBe("7.95/10.0");
    expect(btech[0].coursework).toEqual([{ category: "Core", courses: ["Signals"] }]);
    // … and fields it lacks are filled from the addition instead of a 2nd card.
    expect(btech[0].distinctions?.length).toBeGreaterThan(0);
    expect(merged.entries).toHaveLength(2);
  });

  it("still appends genuinely new additions", () => {
    const merged = mergePage("education", { kind: "education", entries: [] });
    expect(merged.entries.some((e: any) => /bachelor of technology/i.test(e.degree))).toBe(true);
  });
});
