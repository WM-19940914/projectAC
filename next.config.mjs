/** @type {import('next').NextConfig} */
const nextConfig = {
  // @hello-pangea/dnd(드래그앤드롭)가 React Strict Mode에서 동작 안 하는 버그 방지
  reactStrictMode: false,
  // 빌드 시 ESLint 경고/에러 무시 (기존 lint 에러가 빌드 차단하는 것 방지)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // pdfjs-dist가 서버 빌드에서 canvas를 요구하지만 클라이언트에서만 사용하므로 무시
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
};

export default nextConfig;
