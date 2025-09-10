import { createGithubFetcher, type tokenGetter } from "./base";
import { getToken } from "./login";

const create = (tokenGetter: tokenGetter) => {
	const fetcher = createGithubFetcher(tokenGetter);
	const getImage = async (url: string) => {
		// url: https://raw.githubusercontent.com/glink25/oncent-journal-shz/HEAD/49364151/assets/1757506115944-tclgazq07t-tip_2_as.png
		const [owner, repo, ...paths] = url
			.replace("https://raw.githubusercontent.com/", "")
			.replace("HEAD/", "")
			.split("/");

		const res = await fetcher(
			`/repos/${owner}/${repo}/contents/${paths.join("/")}`,
			{
				headers: {
					Accept: "application/vnd.github.raw",
				},
			},
		);
		const blob = await res.blob();
		return blob;
	};

	return { getImage };
};

export const ImageAPI = create(getToken);
