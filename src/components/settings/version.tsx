/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */

import { useEffect, useState } from "react";
import { useIntl } from "@/locale";
import { abbreviatedSha } from "~build/git";
import { version } from "~build/package";

export default function Version() {
    const t = useIntl();

    const [gitVersionVisible, setGitVersionVisible] = useState(false);
    return (
        <div
            className="flex flex-col justify-center items-center"
            onClick={() => {
                setGitVersionVisible((v) => !v);
            }}
        >
            <div className="font-semibold">{t("cent-app-name")}</div>
            {!gitVersionVisible ? (
                <div className="text-xs opacity-60">
                    {t("version")}: {version}
                </div>
            ) : (
                <GitVersionChecker />
            )}
        </div>
    );
}

const CURRENT_GIT_HASH: string = abbreviatedSha;

// GitHub API 地址：获取特定仓库特定分支的最新Commit
const GITHUB_API_URL =
    "https://api.github.com/repos/glink25/cent/branches/main";

// --- 组件定义 ---

const GitVersionChecker: React.FC = () => {
    const [latestHash, setLatestHash] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLatestGitHash = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(GITHUB_API_URL, {
                    headers: {
                        Accept: "application/vnd.github.v3+json",
                    },
                });

                if (!response.ok) {
                    throw new Error(`GitHub API error: ${response.statusText}`);
                }

                const data = await response.json();
                const fetchedHash = data?.commit?.sha;

                if (fetchedHash) {
                    setLatestHash(fetchedHash);
                } else {
                    throw new Error("无法从响应中解析最新的 Commit SHA。");
                }
            } catch (err) {
                console.error(
                    "Failed to fetch latest git hash from GitHub:",
                    err,
                );
                setError("加载最新 Hash 失败。");
            } finally {
                setIsLoading(false);
            }
        };

        fetchLatestGitHash();
    }, []);

    // 截断 Git Hash 以便阅读
    const formatHash = (hash: string) => hash.substring(0, 8);
    const isLatest =
        latestHash && formatHash(CURRENT_GIT_HASH) === formatHash(latestHash);

    return (
        <div className="text-xs">
            {/* 1. 当前部署的 Hash */}
            <div className="flex justify-between items-center py-1">
                <span className="font-semibold text-gray-600">
                    Current:
                    <span
                        className={`ml-1 text-xs font-normal  ${isLatest ? "text-green-700" : "text-red-700"}`}
                    >
                        {isLatest ? "(newest)" : " (outdated)"}
                    </span>
                </span>
                <code className="text-gray-900">
                    {formatHash(CURRENT_GIT_HASH)}
                </code>
            </div>
            <div className="border-t border-gray-200">
                <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-600">Latest:</span>

                    {/* 加载中状态 */}
                    {isLoading && (
                        <i className="icon-[mdi--loading] animate-spin"></i>
                    )}

                    {/* 最新 Hash 展示 */}
                    {latestHash && (
                        <code className={`font-bold`}>
                            {formatHash(latestHash)}
                        </code>
                    )}
                </div>
            </div>
        </div>
    );
};
