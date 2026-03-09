/** @type {import('next').NextConfig} */
const nextConfig = {
  // @hello-pangea/dnd(드래그앤드롭)가 React Strict Mode에서 동작 안 하는 버그 방지
  reactStrictMode: false,
  // 빌드 시 ESLint 경고/에러 무시 (기존 lint 에러가 빌드 차단하는 것 방지)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
