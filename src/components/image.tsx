import { type CSSProperties, useEffect, useRef, useState } from "react";
import { ImageAPI } from "@/api/image";

export default function SmartImage({
	source,
	className,
	alt,
	style,
}: {
	source: string | File;
	className?: string;
	alt?: string;
	style?: CSSProperties;
}) {
	const [url, setUrl] = useState<string>(
		typeof source === "string" ? source : "",
	);
	const objectUrlRef = useRef<string | null>(null);

	useEffect(() => {
		if (!(source instanceof File)) {
			// 普通字符串 url
			if (source.startsWith("https://raw.githubusercontent.com")) {
				ImageAPI.getImage(source).then((file) => {
					const objectUrl = URL.createObjectURL(file);
					objectUrlRef.current = objectUrl;
					setUrl(objectUrl);
				});
				return;
			}
			setUrl(source);
			return () => {};
		}
		// 如果传入的是 File，创建 blob url
		const objectUrl = URL.createObjectURL(source);
		objectUrlRef.current = objectUrl;
		setUrl(objectUrl);

		// 组件卸载或 source 改变时清理
		return () => {
			if (objectUrlRef.current) {
				URL.revokeObjectURL(objectUrlRef.current);
				objectUrlRef.current = null;
			}
		};
	}, [source]);

	if (url === "") return null;
	return <img src={url} className={className} alt={alt} style={style} />;
}
