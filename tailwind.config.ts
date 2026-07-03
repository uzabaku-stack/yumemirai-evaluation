import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: { extend: { colors: { ink: "#24313f", clinic: "#0f766e", mint: "#d9f4ed", coral: "#f47b63", paper: "#fbfaf7" }, boxShadow: { soft: "0 10px 30px rgba(36,49,63,.08)" } } },
  plugins: []
};
export default config;
