var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  insertJobPostingSchema: () => insertJobPostingSchema,
  insertMinistryUrlSchema: () => insertMinistryUrlSchema,
  jobPostings: () => jobPostings,
  ministryUrls: () => ministryUrls,
  searchJobsSchema: () => searchJobsSchema
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var jobPostings = pgTable("job_postings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  ministry: text("ministry").notNull(),
  department: text("department").notNull(),
  jobType: text("job_type").notNull(),
  employmentType: text("employment_type").notNull(),
  location: text("location").notNull(),
  positions: integer("positions").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements").notNull(),
  preferredQualifications: text("preferred_qualifications"),
  applicationPeriodStart: timestamp("application_period_start").notNull(),
  applicationPeriodEnd: timestamp("application_period_end").notNull(),
  contact: text("contact").notNull(),
  originalUrl: text("original_url").notNull(),
  pdfUrl: text("pdf_url"),
  isUrgent: boolean("is_urgent").default(false),
  isNew: boolean("is_new").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var ministryUrls = pgTable("ministry_urls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  isActive: boolean("is_active").default(true),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").default(sql`now()`)
});
var insertJobPostingSchema = createInsertSchema(jobPostings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertMinistryUrlSchema = createInsertSchema(ministryUrls).omit({
  id: true,
  createdAt: true
});
var searchJobsSchema = z.object({
  query: z.string().optional(),
  ministry: z.string().optional(),
  jobType: z.string().optional(),
  employmentType: z.string().optional(),
  sortBy: z.enum(["latest", "deadline", "ministry"]).default("latest"),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10)
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, desc, asc, and, or, like, count, sql as sql2, gte } from "drizzle-orm";
var DatabaseStorage = class {
  async getJobPosting(id) {
    const [jobPosting] = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
    return jobPosting || void 0;
  }
  async getJobPostings(filters = {}) {
    const conditions = [];
    const currentDate = /* @__PURE__ */ new Date();
    conditions.push(gte(jobPostings.applicationPeriodEnd, currentDate));
    if (filters.query) {
      const searchTerm = `%${filters.query.toLowerCase()}%`;
      conditions.push(
        or(
          like(sql2`lower(${jobPostings.title})`, searchTerm),
          like(sql2`lower(${jobPostings.ministry})`, searchTerm),
          like(sql2`lower(${jobPostings.jobType})`, searchTerm),
          like(sql2`lower(${jobPostings.description})`, searchTerm)
        )
      );
    }
    if (filters.ministry && filters.ministry !== "\uC804\uCCB4 \uBD80\uCC98") {
      conditions.push(eq(jobPostings.ministry, filters.ministry));
    }
    if (filters.jobType && filters.jobType !== "\uC804\uCCB4 \uC9C1\uC885") {
      conditions.push(like(jobPostings.jobType, `%${filters.jobType}%`));
    }
    if (filters.employmentType && filters.employmentType !== "\uC804\uCCB4 \uACE0\uC6A9\uD615\uD0DC") {
      conditions.push(eq(jobPostings.employmentType, filters.employmentType));
    }
    const [{ count: total }] = await db.select({ count: count() }).from(jobPostings).where(and(...conditions));
    const query = db.select().from(jobPostings).where(and(...conditions));
    let orderedQuery;
    switch (filters.sortBy) {
      case "deadline":
        orderedQuery = query.orderBy(asc(jobPostings.applicationPeriodEnd));
        break;
      case "ministry":
        orderedQuery = query.orderBy(asc(jobPostings.ministry));
        break;
      case "latest":
      default:
        orderedQuery = query.orderBy(desc(jobPostings.createdAt));
        break;
    }
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;
    const jobPostingsList = await orderedQuery.limit(limit).offset(offset);
    return {
      jobPostings: jobPostingsList,
      total
    };
  }
  async createJobPosting(insertJobPosting) {
    const [jobPosting] = await db.insert(jobPostings).values(insertJobPosting).returning();
    return jobPosting;
  }
  async getStatistics() {
    const [totalResult] = await db.select({ count: count() }).from(jobPostings);
    const [urgentResult] = await db.select({ count: count() }).from(jobPostings).where(eq(jobPostings.isUrgent, true));
    const [newResult] = await db.select({ count: count() }).from(jobPostings).where(eq(jobPostings.isNew, true));
    const ministryResult = await db.selectDistinct({ ministry: jobPostings.ministry }).from(jobPostings);
    return {
      totalJobs: totalResult.count,
      urgentJobs: urgentResult.count,
      newJobs: newResult.count,
      ministries: ministryResult.length
    };
  }
  async getMinistryUrls() {
    return await db.select().from(ministryUrls).where(eq(ministryUrls.isActive, true));
  }
  async updateMinistryLastChecked(id) {
    await db.update(ministryUrls).set({ lastChecked: /* @__PURE__ */ new Date() }).where(eq(ministryUrls.id, id));
  }
  async deleteOldJobPostings(daysOld = 60) {
    const cutoffDate = /* @__PURE__ */ new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const result = await db.delete(jobPostings).where(sql2`${jobPostings.createdAt} < ${cutoffDate}`).returning({ id: jobPostings.id });
    return result.length;
  }
  async checkIfJobExists(title, ministry) {
    const [result] = await db.select({ count: count() }).from(jobPostings).where(and(
      eq(jobPostings.title, title),
      eq(jobPostings.ministry, ministry)
    ));
    return result.count > 0;
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
import { z as z2 } from "zod";
async function registerRoutes(app2) {
  app2.get("/api/jobs", async (req, res) => {
    try {
      const queryParams = {
        ...req.query,
        page: req.query.page ? parseInt(req.query.page) : 1,
        limit: req.query.limit ? parseInt(req.query.limit) : 10
      };
      const filters = searchJobsSchema.parse(queryParams);
      const result = await storage.getJobPostings(filters);
      res.json(result);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ error: "Invalid query parameters", details: error.errors });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });
  app2.get("/api/jobs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const jobPosting = await storage.getJobPosting(id);
      if (!jobPosting) {
        res.status(404).json({ error: "Job posting not found" });
        return;
      }
      res.json(jobPosting);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/statistics", async (req, res) => {
    try {
      const stats = await storage.getStatistics();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/pdfs/:filename", (req, res) => {
    const { filename } = req.params;
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources << /Font << /F1 5 0 R >> >>
>>
endobj

4 0 obj
<<
/Length 280
>>
stream
BT
/F1 16 Tf
50 720 Td
(\uC815\uBD80 \uCC44\uC6A9\uACF5\uACE0 \uC6D0\uBCF8 \uBB38\uC11C) Tj
0 -30 Td
/F1 12 Tf
(\uD30C\uC77C\uBA85: ${filename}) Tj
0 -25 Td
(\uC774 \uBB38\uC11C\uB294 \uB370\uBAA8\uC6A9 \uC0D8\uD50C PDF\uC785\uB2C8\uB2E4.) Tj
0 -25 Td
(\uC2E4\uC81C \uC815\uBD80 \uCC44\uC6A9\uACF5\uACE0 PDF\uAC00 \uC5EC\uAE30\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.) Tj
0 -40 Td
(\uD604\uC7AC \uAD6C\uD604\uB41C \uAE30\uB2A5:) Tj
0 -20 Td
(\u2022 \uCC44\uC6A9\uACF5\uACE0 \uBAA9\uB85D \uC870\uD68C) Tj
0 -20 Td
(\u2022 \uBD80\uCC98\uBCC4 \uD544\uD130\uB9C1) Tj
0 -20 Td
(\u2022 \uC0C1\uC138\uC815\uBCF4 \uBCF4\uAE30) Tj
0 -20 Td
(\u2022 PDF \uBB38\uC11C \uBDF0\uC5B4) Tj
0 -40 Td
(\uD5A5\uD6C4 \uC2E4\uC81C \uC815\uBD80 \uC0AC\uC774\uD2B8 API \uC5F0\uB3D9 \uC608\uC815) Tj
ET
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000251 00000 n 
0000000583 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
650
%%EOF`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.status(200).send(Buffer.from(pdfContent));
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/initializeData.ts
import { count as count2 } from "drizzle-orm";
var MINISTRY_URLS = [
  { name: "\uAE30\uD68D\uC7AC\uC815\uBD80", url: "https://www.moef.go.kr/nw/notice/emrc.do;jsessionid=FzBiPexPRZpNxQLxalwGq2H7YwhB4t59BUq8JqAz.node20?menuNo=4050200" },
  { name: "\uAD50\uC721\uBD80", url: "https://www.moe.go.kr/boardCnts/listRenew.do?boardID=194&m=020602&s=moe" },
  { name: "\uACFC\uD559\uAE30\uC220\uC815\uBCF4\uD1B5\uC2E0\uBD80", url: "https://www.msit.go.kr/bbs/list.do?sCode=user&mPid=121&mId=125" },
  { name: "\uC678\uAD50\uBD80", url: "https://www.mofa.go.kr/www/brd/m_4079/list.do" },
  { name: "\uD1B5\uC77C\uBD80", url: "https://www.unikorea.go.kr/unikorea/notify/recruit/" },
  { name: "\uBC95\uBB34\uBD80", url: "https://www.moj.go.kr/moj/225/subview.do" },
  { name: "\uAD6D\uBC29\uBD80", url: "https://www.mnd.go.kr/user/boardList.action?boardId=I_26382&mcategoryId=&id=mnd_020403000000" },
  { name: "\uD589\uC815\uC548\uC804\uBD80", url: "https://www.mois.go.kr/frt/bbs/type013/commonSelectBoardList.do?bbsId=BBSMSTR_000000000006" },
  { name: "\uAD6D\uAC00\uBCF4\uD6C8\uBD80", url: "https://www.mpva.go.kr/mpva/selectBbsNttList.do?bbsNo=360&key=1801" },
  { name: "\uBB38\uD654\uCCB4\uC721\uAD00\uAD11\uBD80", url: "https://www.mcst.go.kr/kor/s_notice/notice/jobList.jsp" },
  { name: "\uB18D\uB9BC\uCD95\uC0B0\uC2DD\uD488\uBD80", url: "https://www.mafra.go.kr/home/5111/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGaG9tZSUyRjc5NCUyRmFydGNsTGlzdC5kbyUzRg%3D%3D" },
  { name: "\uC0B0\uC5C5\uD1B5\uC0C1\uC790\uC6D0\uBD80", url: "https://www.motie.go.kr/kor/article/ATCL2527aa115" },
  { name: "\uBCF4\uAC74\uBCF5\uC9C0\uBD80", url: "https://www.mohw.go.kr/board.es?mid=a10501010400&bid=0003&cg_code=C02" },
  { name: "\uD658\uACBD\uBD80", url: "https://www.me.go.kr/home/web/index.do?menuId=10530" },
  { name: "\uACE0\uC6A9\uB178\uB3D9\uBD80", url: "https://www.moel.go.kr/news/notice/noticeList.do?searchDivCd=004" },
  { name: "\uC5EC\uC131\uAC00\uC871\uBD80", url: "https://www.mogef.go.kr/nw/ntc/nw_ntc_s001.do?div1=13&div3=10" },
  { name: "\uAD6D\uD1A0\uAD50\uD1B5\uBD80", url: "https://www.molit.go.kr/USR/BORD0201/m_81/BRD.jsp" },
  { name: "\uC778\uC0AC\uD601\uC2E0\uCC98", url: "https://www.mpm.go.kr/mpm/info/infoJobs/jobsBoard/?mode=list&boardId=bbs_0000000000000118&category=%EC%B1%84%EC%9A%A9" },
  { name: "\uBC95\uC81C\uCC98", url: "https://www.moleg.go.kr/board.es?mid=a10504000000&bid=0010" },
  { name: "\uC2DD\uD488\uC758\uC57D\uD488\uC548\uC804\uCC98", url: "https://www.nifds.go.kr/brd/m_22/list.do?page=1&srchFr=&srchTo=&srchWord=&srchTp=&itm_seq_1=0&itm_seq_2=0&multi_itm_seq=0&company_cd=&company_nm=" },
  { name: "\uACF5\uC815\uAC70\uB798\uC704\uC6D0\uD68C", url: "https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=4&key=14" },
  { name: "\uAD6D\uBBFC\uAD8C\uC775\uC704\uC6D0\uD68C", url: "https://www.acrc.go.kr/board.es?mid=a10401020000&bid=2B" },
  { name: "\uAE08\uC735\uC704\uC6D0\uD68C", url: "https://www.fsc.go.kr/no010104" },
  { name: "\uAC1C\uC778\uC815\uBCF4\uBCF4\uD638\uC704\uC6D0\uD68C", url: "https://www.pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS208&mCode=C010020000" },
  { name: "\uC6D0\uC790\uB825\uC548\uC804\uC704\uC6D0\uD68C", url: "https://www.nssc.go.kr/ko/cms/FR_CON/index.do?MENU_ID=180" }
];
var SAMPLE_JOB_POSTINGS = [
  {
    title: "2024\uB144 \uD589\uC815\uC548\uC804\uBD80 \uB514\uC9C0\uD138\uC815\uBD80\uD601\uC2E0\uC2E4 \uC815\uBCF4\uBCF4\uC548 \uC804\uBB38\uAC00 \uCC44\uC6A9",
    ministry: "\uD589\uC815\uC548\uC804\uBD80",
    department: "\uB514\uC9C0\uD138\uC815\uBD80\uD601\uC2E0\uC2E4",
    jobType: "\uAE30\uC220\uC9C1 7\uAE09",
    employmentType: "\uC815\uADDC\uC9C1",
    location: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uC885\uB85C\uAD6C \uC138\uC885\uB300\uB85C 209",
    positions: 3,
    description: "\uC815\uBD80 \uC815\uBCF4\uBCF4\uC548 \uC815\uCC45 \uC218\uB9BD \uBC0F \uC2DC\uD589, \uC0AC\uC774\uBC84\uBCF4\uC548 \uCCB4\uACC4 \uAD6C\uCD95 \uBC0F \uC6B4\uC601, \uC815\uBCF4\uBCF4\uC548 \uAD00\uB828 \uBC95\uB839 \uC81C\xB7\uAC1C\uC815 \uC5C5\uBB34, \uC815\uBCF4\uBCF4\uC548 \uAD50\uC721 \uBC0F \uD64D\uBCF4 \uC5C5\uBB34, \uAD6D\uC81C \uC0AC\uC774\uBC84\uBCF4\uC548 \uD611\uB825 \uC5C5\uBB34",
    requirements: "\uC815\uBCF4\uBCF4\uC548 \uAD00\uB828 \uD559\uACFC \uC878\uC5C5\uC790 \uB610\uB294 \uAD00\uB828 \uC790\uACA9\uC99D \uC18C\uC9C0\uC790, \uC815\uBCF4\uBCF4\uC548 \uBD84\uC57C 3\uB144 \uC774\uC0C1 \uACBD\uB825\uC790, \uCEF4\uD4E8\uD130\uD65C\uC6A9\uB2A5\uB825 1\uAE09 \uC774\uC0C1, \uC601\uC5B4 \uAC00\uB2A5\uC790 \uC6B0\uB300",
    preferredQualifications: "\uC815\uBCF4\uBCF4\uC548\uAE30\uC0AC, CISSP, CISA \uB4F1 \uC815\uBCF4\uBCF4\uC548 \uAD00\uB828 \uC790\uACA9\uC99D \uC18C\uC9C0\uC790, \uACF5\uACF5\uAE30\uAD00 \uC815\uBCF4\uBCF4\uC548 \uC5C5\uBB34 \uACBD\uD5D8\uC790, \uC11D\uC0AC\uD559\uC704 \uC774\uC0C1 \uC18C\uC9C0\uC790",
    applicationPeriodStart: /* @__PURE__ */ new Date("2024-01-15"),
    applicationPeriodEnd: /* @__PURE__ */ new Date("2024-03-15"),
    contact: "02-2100-3000",
    originalUrl: "https://www.mois.go.kr/frt/bbs/type013/commonSelectBoardList.do?bbsId=BBSMSTR_000000000006",
    pdfUrl: "/api/pdfs/mois-security-expert.pdf",
    isUrgent: true,
    isNew: false
  },
  {
    title: "2024\uB144 \uAE30\uD68D\uC7AC\uC815\uBD80 \uC608\uC0B0\uC815\uCC45\uAD6D \uC608\uC0B0\uBD84\uC11D\uAD00 \uCC44\uC6A9",
    ministry: "\uAE30\uD68D\uC7AC\uC815\uBD80",
    department: "\uC608\uC0B0\uC815\uCC45\uAD6D",
    jobType: "\uD589\uC815\uC9C1 6\uAE09",
    employmentType: "\uC815\uADDC\uC9C1",
    location: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uC885\uB85C\uAD6C \uC138\uC885\uB300\uB85C 209",
    positions: 2,
    description: "\uAD6D\uAC00\uC608\uC0B0 \uD3B8\uC131 \uBC0F \uBD84\uC11D, \uC7AC\uC815\uC815\uCC45 \uC5F0\uAD6C \uBC0F \uAE30\uD68D, \uC608\uC0B0\uC548 \uC791\uC131 \uBC0F \uC2EC\uC758 \uC9C0\uC6D0, \uC7AC\uC815\uD1B5\uACC4 \uAD00\uB9AC \uBC0F \uBD84\uC11D",
    requirements: "\uACBD\uC81C\uD559, \uD589\uC815\uD559, \uD68C\uACC4\uD559 \uAD00\uB828 \uD559\uACFC \uC878\uC5C5\uC790, \uC608\uC0B0 \uB610\uB294 \uC7AC\uC815 \uBD84\uC57C \uACBD\uB825 3\uB144 \uC774\uC0C1, \uC5D1\uC140 \uACE0\uAE09 \uD65C\uC6A9 \uAC00\uB2A5\uC790",
    preferredQualifications: "\uACF5\uC778\uD68C\uACC4\uC0AC, \uC138\uBB34\uC0AC \uB4F1 \uAD00\uB828 \uC790\uACA9\uC99D \uC18C\uC9C0\uC790, \uACF5\uACF5\uAE30\uAD00 \uC608\uC0B0 \uC5C5\uBB34 \uACBD\uD5D8\uC790, \uC11D\uC0AC\uD559\uC704 \uC774\uC0C1 \uC18C\uC9C0\uC790",
    applicationPeriodStart: /* @__PURE__ */ new Date("2024-01-20"),
    applicationPeriodEnd: /* @__PURE__ */ new Date("2024-03-25"),
    contact: "044-215-2114",
    originalUrl: "https://www.moef.go.kr/nw/notice/emrc.do",
    pdfUrl: "/api/pdfs/moef-budget-analyst.pdf",
    isUrgent: false,
    isNew: false
  },
  {
    title: "2024\uB144 \uACE0\uC6A9\uB178\uB3D9\uBD80 \uACE0\uC6A9\uC815\uCC45\uC2E4 \uB178\uB3D9\uC2DC\uC7A5\uBD84\uC11D \uC5F0\uAD6C\uC6D0 \uCC44\uC6A9",
    ministry: "\uACE0\uC6A9\uB178\uB3D9\uBD80",
    department: "\uACE0\uC6A9\uC815\uCC45\uC2E4",
    jobType: "\uC5F0\uAD6C\uC9C1",
    employmentType: "\uACC4\uC57D\uC9C1",
    location: "\uC138\uC885\uD2B9\uBCC4\uC790\uCE58\uC2DC \uD55C\uB204\uB9AC\uB300\uB85C 422",
    positions: 5,
    description: "\uB178\uB3D9\uC2DC\uC7A5 \uB3D9\uD5A5 \uBD84\uC11D \uBC0F \uC804\uB9DD, \uACE0\uC6A9\uC815\uCC45 \uC5F0\uAD6C\uAC1C\uBC1C, \uB178\uB3D9\uD1B5\uACC4 \uC218\uC9D1 \uBC0F \uBD84\uC11D, \uACE0\uC6A9\uC815\uCC45 \uD6A8\uACFC\uC131 \uD3C9\uAC00",
    requirements: "\uACBD\uC81C\uD559, \uD1B5\uACC4\uD559, \uC0AC\uD68C\uD559 \uAD00\uB828 \uD559\uACFC \uC878\uC5C5\uC790, \uC5F0\uAD6C \uACBD\uB825 2\uB144 \uC774\uC0C1, \uD1B5\uACC4\uBD84\uC11D \uD504\uB85C\uADF8\uB7A8 \uD65C\uC6A9 \uAC00\uB2A5\uC790",
    preferredQualifications: "\uBC15\uC0AC\uD559\uC704 \uC18C\uC9C0\uC790, \uB178\uB3D9\uACBD\uC81C\uD559 \uC804\uACF5\uC790, \uC601\uC5B4 \uB2A5\uD1B5\uC790, \uAD00\uB828 \uC5F0\uAD6C\uC18C \uACBD\uB825\uC790",
    applicationPeriodStart: /* @__PURE__ */ new Date("2024-02-01"),
    applicationPeriodEnd: /* @__PURE__ */ new Date("2024-04-05"),
    contact: "044-202-7100",
    originalUrl: "https://www.moel.go.kr/news/notice/noticeList.do",
    pdfUrl: "/api/pdfs/moel-labor-researcher.pdf",
    isUrgent: false,
    isNew: true
  }
];
async function initializeMinistryUrls() {
  try {
    const [existingCount] = await db.select({ count: count2() }).from(ministryUrls);
    if (existingCount.count === 0) {
      console.log("\u{1F3DB}\uFE0F Initializing ministry URLs...");
      await db.insert(ministryUrls).values(
        MINISTRY_URLS.map((ministry) => ({
          name: ministry.name,
          url: ministry.url,
          isActive: true
        }))
      );
      console.log(`\u2705 Initialized ${MINISTRY_URLS.length} ministry URLs`);
    } else {
      console.log(`\u{1F4CB} Ministry URLs already initialized (${existingCount.count} entries)`);
    }
  } catch (error) {
    console.error("\u274C Error initializing ministry URLs:", error);
    throw error;
  }
}
async function initializeSampleJobPostings() {
  try {
    const [existingCount] = await db.select({ count: count2() }).from(jobPostings);
    if (existingCount.count === 0) {
      console.log("\u{1F4CB} Initializing sample job postings...");
      await db.insert(jobPostings).values(SAMPLE_JOB_POSTINGS);
      console.log(`\u2705 Initialized ${SAMPLE_JOB_POSTINGS.length} sample job postings`);
    } else {
      console.log(`\u{1F4C4} Job postings already exist (${existingCount.count} entries)`);
    }
  } catch (error) {
    console.error("\u274C Error initializing sample job postings:", error);
    throw error;
  }
}
async function initializeDatabase() {
  console.log("\u{1F680} Starting database initialization...");
  try {
    await initializeMinistryUrls();
    await initializeSampleJobPostings();
    console.log("\u2705 Database initialization completed successfully");
  } catch (error) {
    console.error("\u274C Database initialization failed:", error);
    throw error;
  }
}

// server/scraper.ts
async function scrapeMinistryJobs() {
  console.log("\u{1F50D} Starting ministry job scraping...");
  try {
    const ministryUrls2 = await storage.getMinistryUrls();
    console.log(`\u{1F4CB} Found ${ministryUrls2.length} ministry URLs to check`);
    for (const ministry of ministryUrls2) {
      try {
        console.log(`\u{1F3DB}\uFE0F Checking ${ministry.name}...`);
        const scrapedJobs = await scrapeJobsFromUrl(ministry.url, ministry.name);
        console.log(`\u{1F4C4} Found ${scrapedJobs.length} job postings from ${ministry.name}`);
        for (const job of scrapedJobs) {
          const exists = await storage.checkIfJobExists(job.title, job.ministry);
          if (!exists) {
            const insertJob = {
              title: job.title,
              ministry: job.ministry,
              department: job.department,
              jobType: job.jobType,
              employmentType: job.employmentType,
              location: job.location,
              positions: job.positions,
              description: job.description,
              requirements: job.requirements,
              preferredQualifications: job.preferredQualifications,
              applicationPeriodStart: job.applicationPeriodStart,
              applicationPeriodEnd: job.applicationPeriodEnd,
              contact: job.contact,
              originalUrl: job.originalUrl,
              pdfUrl: job.pdfUrl,
              isUrgent: job.isUrgent,
              isNew: true
              // 새로 추가된 공고는 isNew = true
            };
            await storage.createJobPosting(insertJob);
            console.log(`\u2705 Added new job: ${job.title}`);
          }
        }
        await storage.updateMinistryLastChecked(ministry.id);
      } catch (error) {
        console.error(`\u274C Error scraping ${ministry.name}:`, error);
      }
    }
    const deletedCount = await storage.deleteOldJobPostings(60);
    if (deletedCount > 0) {
      console.log(`\u{1F5D1}\uFE0F Deleted ${deletedCount} old job postings (60+ days)`);
    }
    console.log("\u2705 Ministry job scraping completed");
  } catch (error) {
    console.error("\u274C Error in ministry job scraping:", error);
  }
}
async function scrapeJobsFromUrl(url, ministryName) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    if (!response.ok) {
      console.log(`\u26A0\uFE0F Failed to fetch ${ministryName}: ${response.status}`);
      return [];
    }
    const html = await response.text();
    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);
    const jobs = [];
    const selectors = [
      // 일반적인 게시판 구조
      "table tbody tr",
      ".board-list tbody tr",
      ".list tbody tr",
      ".notice-list li",
      ".board tbody tr",
      ".tbl tbody tr",
      ".board_list tbody tr",
      // 특정 부처 구조
      ".bbs-list-body tr",
      ".board_type01 tbody tr",
      ".notice_list li",
      // 고용노동부 전용 (새로 추가)
      ".board_list tr",
      ".list_table tbody tr",
      "tbody tr"
    ];
    for (const selector of selectors) {
      const rows = $(selector);
      if (rows.length > 0) {
        rows.each((index, element) => {
          try {
            const $row = $(element);
            let title = "";
            const titleSelectors = [
              ".title a",
              ".subject a",
              "td:nth-child(2) a",
              "td:nth-child(3) a",
              ".tit a",
              'a[href*="view"]',
              'a[href*="detail"]',
              "td a",
              // 고용노동부 전용 추가
              "td:first-child + td a",
              ".subject",
              "td:nth-child(2)",
              "td:nth-child(3)"
            ];
            for (const titleSelector of titleSelectors) {
              const titleEl = $row.find(titleSelector).first();
              if (titleEl.length > 0) {
                title = titleEl.text().trim();
                break;
              }
            }
            if (ministryName === "\uACE0\uC6A9\uB178\uB3D9\uBD80") {
              const fullRowText = $row.text().trim();
              const cells = $row.find("td");
              cells.each((index2, cell) => {
                const cellText = $(cell).text().trim();
                if (cellText.includes("[\uC778\uC0AC]")) {
                  title = cellText;
                  return false;
                }
              });
              if (!title && fullRowText.includes("[\uC778\uC0AC]")) {
                const match = fullRowText.match(/\[인사\]\s*(.+?)(?:\s+\d{4}\.\d{2}\.\d{2}|$)/);
                if (match && match[1]) {
                  title = `[\uC778\uC0AC] ${match[1].trim()}`;
                } else {
                  title = fullRowText;
                }
              }
              if (!title) {
                const link = $row.find('a[href*="noticeView"]');
                if (link.length > 0) {
                  const linkText = link.text().trim();
                  if (linkText.includes("[\uC778\uC0AC]")) {
                    title = linkText;
                  }
                }
              }
              if (!title && fullRowText.includes("[\uC778\uC0AC]")) {
                title = fullRowText;
              }
            }
            if (title && isRecruitmentRelated(title, ministryName)) {
              let dateText = "";
              const dateSelectors = [
                ".date",
                ".reg_date",
                "td:nth-child(4)",
                "td:nth-child(5)",
                "td:last-child"
              ];
              for (const dateSelector of dateSelectors) {
                const dateEl = $row.find(dateSelector).first();
                if (dateEl.length > 0) {
                  dateText = dateEl.text().trim();
                  break;
                }
              }
              let detailUrl = "";
              const linkEl = $row.find("a").first();
              if (linkEl.length > 0) {
                const href = linkEl.attr("href");
                if (href) {
                  detailUrl = href.startsWith("http") ? href : url + href;
                }
              }
              jobs.push({
                title,
                ministry: ministryName,
                department: "\uAE30\uD68D\uC870\uC815\uC2E4",
                jobType: extractJobType(title),
                employmentType: extractEmploymentType(title),
                location: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC",
                positions: extractPositions(title),
                description: `${title} - ${ministryName}\uC5D0\uC11C \uBAA8\uC9D1\uD558\uB294 \uCC44\uC6A9\uACF5\uACE0\uC785\uB2C8\uB2E4.`,
                requirements: "\uD574\uB2F9 \uBD84\uC57C \uC804\uACF5\uC790 \uB610\uB294 \uAD00\uB828 \uACBD\uB825\uC790",
                preferredQualifications: "\uAD00\uB828 \uC790\uACA9\uC99D \uC18C\uC9C0\uC790 \uC6B0\uB300",
                applicationPeriodStart: /* @__PURE__ */ new Date(),
                applicationPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3),
                contact: "\uD574\uB2F9 \uBD80\uCC98 \uC778\uC0AC\uB2F4\uB2F9\uBD80\uC11C",
                originalUrl: detailUrl || url,
                pdfUrl: `/api/pdfs/${ministryName}-${Date.now()}.pdf`,
                isUrgent: title.includes("\uAE34\uAE09") || title.includes("\uD2B9\uBCC4"),
                isNew: true
              });
            }
          } catch (error) {
          }
        });
        if (jobs.length > 0) {
          break;
        }
      }
    }
    if (ministryName === "\uACE0\uC6A9\uB178\uB3D9\uBD80") {
      console.log(`\u{1F50D} [DEBUG] ${ministryName} - Final jobs found: ${jobs.length}`);
      const allText = $.text();
      const hasPersonnelLabel = allText.includes("[\uC778\uC0AC]");
      console.log(`\u{1F50D} [DEBUG] Page contains [\uC778\uC0AC] label: ${hasPersonnelLabel}`);
      if (hasPersonnelLabel) {
        console.log(`\u{1F50D} [DEBUG] Searching for [\uC778\uC0AC] labeled content...`);
        $("tr").each((index, row) => {
          const rowText = $(row).text();
          if (rowText.includes("[\uC778\uC0AC]")) {
            console.log(`\u{1F50D} [DEBUG] Found [\uC778\uC0AC] in row ${index}: ${rowText.substring(0, 150)}`);
          }
        });
        $("a").each((index, link) => {
          const linkText = $(link).text();
          if (linkText.includes("[\uC778\uC0AC]")) {
            console.log(`\u{1F50D} [DEBUG] Found [\uC778\uC0AC] in link: ${linkText}`);
          }
        });
        $("td").each((index, cell) => {
          const cellText = $(cell).text();
          if (cellText.includes("[\uC778\uC0AC]")) {
            console.log(`\u{1F50D} [DEBUG] Found [\uC778\uC0AC] in cell: ${cellText}`);
          }
        });
      }
    }
    return jobs.slice(0, 3);
  } catch (error) {
    console.log(`\u26A0\uFE0F Error scraping ${ministryName}:`, error);
    return [];
  }
}
function isRecruitmentRelated(title, ministryName) {
  const strictFilterMinistries = ["\uD589\uC815\uC548\uC804\uBD80", "\uACE0\uC6A9\uB178\uB3D9\uBD80", "\uBC95\uC81C\uCC98"];
  if (strictFilterMinistries.includes(ministryName)) {
    if (ministryName === "\uACE0\uC6A9\uB178\uB3D9\uBD80") {
      return title.includes("[\uC778\uC0AC]") || title.includes("\uC778\uC0AC") || title.includes("\uCC44\uC6A9") || title.includes("\uBAA8\uC9D1") || title.includes("\uC784\uC6A9") || title.includes("\uC120\uBC1C") || title.includes("\uACF5\uBB34\uC6D0") || title.includes("\uC9C1\uC6D0") || title.includes("\uC784\uAE30\uC81C") || title.includes("\uACF5\uBB34\uC9C1") || title.includes("\uADFC\uB85C\uC790") || title.includes("\uACC4\uC57D\uC9C1");
    }
    if (ministryName === "\uD589\uC815\uC548\uC804\uBD80") {
      const moiKeywords = ["\uCC44\uC6A9", "\uC784\uAE30\uC81C", "\uACF5\uBB34\uC9C1", "\uADFC\uB85C\uC790"];
      return moiKeywords.some((keyword) => title.includes(keyword));
    }
    const strictKeywords = [
      "\uCC44\uC6A9",
      "\uC784\uAE30\uC81C",
      "\uACF5\uBB34\uC9C1",
      "\uADFC\uB85C\uC790",
      "\uBAA8\uC9D1",
      "\uACBD\uB825\uACBD\uC7C1",
      "\uC120\uBC1C",
      "\uC2DC\uD5D8",
      "\uC784\uC6A9",
      "\uACF5\uACE0",
      "\uAE30\uAC04\uC81C",
      "\uACC4\uC57D\uC9C1",
      "\uC815\uADDC\uC9C1",
      "\uACF5\uBB34\uC6D0",
      "\uC9C1\uC6D0",
      "\uC5F0\uAD6C\uC6D0",
      "\uC804\uBB38\uC704\uC6D0",
      "\uC0AC\uBB34\uBCF4\uC870",
      "\uC2E4\uBB34\uC6D0",
      "\uC804\uBB38\uC784\uAE30\uC81C"
    ];
    const excludeKeywords = [
      "\uC785\uCC30",
      "\uC124\uBA85\uD68C",
      "\uAC04\uB2F4\uD68C",
      "\uD1A0\uB860\uD68C",
      "\uAD50\uC721",
      "\uC138\uBBF8\uB098",
      "\uC6CC\uD06C\uC20D",
      "\uD3EC\uB7FC",
      "\uCEE8\uD37C\uB7F0\uC2A4",
      "\uC608\uC0B0",
      "\uC0AC\uC5C5\uACC4\uD68D",
      "\uBCF4\uACE0\uC11C"
    ];
    if (excludeKeywords.some((keyword) => title.includes(keyword)) && !title.includes("\uACF5\uACE0")) {
      return false;
    }
    return strictKeywords.some((keyword) => title.includes(keyword));
  } else {
    const generalKeywords = [
      "\uCC44\uC6A9",
      "\uBAA8\uC9D1",
      "\uACF5\uACE0",
      "\uC120\uBC1C",
      "\uC784\uC6A9",
      "\uC2E0\uADDC",
      "\uACBD\uB825",
      "\uACC4\uC57D\uC9C1",
      "\uC815\uADDC\uC9C1",
      "\uC778\uD134",
      "\uACF5\uBB34\uC6D0",
      "\uC9C1\uC6D0",
      "\uC5F0\uAD6C\uC6D0",
      "\uC804\uBB38\uC704\uC6D0",
      "\uC784\uAE30\uC81C",
      "\uACF5\uBB34\uC9C1",
      "\uADFC\uB85C\uC790"
    ];
    return generalKeywords.some((keyword) => title.includes(keyword));
  }
}
function extractJobType(title) {
  if (title.includes("\uC5F0\uAD6C")) return "\uC5F0\uAD6C\uC9C1";
  if (title.includes("\uAE30\uC220")) return "\uAE30\uC220\uC9C1";
  if (title.includes("\uC804\uBB38")) return "\uC804\uBB38\uC9C1";
  if (title.includes("\uACC4\uC57D")) return "\uACC4\uC57D\uC9C1";
  return "\uD589\uC815\uC9C1";
}
function extractEmploymentType(title) {
  if (title.includes("\uACC4\uC57D") || title.includes("\uC784\uC2DC")) return "\uACC4\uC57D\uC9C1";
  if (title.includes("\uC778\uD134") || title.includes("\uD30C\uACAC")) return "\uC778\uD134";
  return "\uC815\uADDC\uC9C1";
}
function extractPositions(title) {
  const match = title.match(/(\d+)명|(\d+)인/);
  if (match) {
    return parseInt(match[1] || match[2]);
  }
  return Math.floor(Math.random() * 3) + 1;
}
function startPeriodicScraping(intervalMinutes = 5) {
  console.log(`\u{1F550} Starting periodic scraping every ${intervalMinutes} minutes`);
  scrapeMinistryJobs();
  setInterval(() => {
    scrapeMinistryJobs();
  }, intervalMinutes * 60 * 1e3);
}
function startOldJobCleanup() {
  console.log("\u{1F550} Starting daily old job cleanup scheduler");
  const now = /* @__PURE__ */ new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const timeUntilMidnight = tomorrow.getTime() - now.getTime();
  setTimeout(() => {
    storage.deleteOldJobPostings(60).then((deletedCount) => {
      if (deletedCount > 0) {
        console.log(`\u{1F5D1}\uFE0F Daily cleanup: Deleted ${deletedCount} old job postings`);
      }
    });
    setInterval(async () => {
      const deletedCount = await storage.deleteOldJobPostings(60);
      if (deletedCount > 0) {
        console.log(`\u{1F5D1}\uFE0F Daily cleanup: Deleted ${deletedCount} old job postings`);
      }
    }, 24 * 60 * 60 * 1e3);
  }, timeUntilMidnight);
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  await initializeDatabase();
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
    startPeriodicScraping(5);
    startOldJobCleanup();
  });
})();
