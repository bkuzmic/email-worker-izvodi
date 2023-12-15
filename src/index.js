import PostalMime from 'postal-mime';

async function streamToArrayBuffer(stream, streamSize) {
	let result = new Uint8Array(streamSize);
	let bytesRead = 0;
	const reader = stream.getReader();
	while (true) {
	  const { done, value } = await reader.read();
	  if (done) {
		break;
	  }
	  result.set(value, bytesRead);
	  bytesRead += value.length;
	}
	return result;
}

export default {
	async email(message, env, ctx) {
		const allowList = env.ALLOWED_FROM_ADDRESSES;
		if (allowList.indexOf(message.from) == -1) {
			message.setReject("Address not allowed");
		}
		const rawEmail = await streamToArrayBuffer(message.raw, message.rawSize);
		const parser = new PostalMime();
		const parsedEmail = await parser.parse(rawEmail);
		console.log("Mail subject: ", parsedEmail.subject);
		if (parsedEmail.attachments.length == 0) {
			console.log("No attachments. Skipping sending to DropBox");
		} else {
			const BankStatementSubjectPrefix = env.BANK_STATEMENT_SUBJECT_PREFIX;
			if (parsedEmail.subject.indexOf(BankStatementSubjectPrefix) > 0) {
				const beginIndex = parsedEmail.subject.indexOf(BankStatementSubjectPrefix) + BankStatementSubjectPrefix.length;
				const endIndex = parsedEmail.subject.indexOf(",");
				const bankStatementId = parsedEmail.subject.substring(beginIndex, endIndex).trim();
				let currentYear = new Date().getUTCFullYear();
				const attFileName = currentYear + bankStatementId + "-" + currentYear + bankStatementId + ".html";
				// get DropBox Access Token with Refresh Token
				const access = {
					grant_type: "refresh_token",
					refresh_token: `${env.DB_REFRESH_TOKEN}`,
					client_id: `${env.DB_CLIENT_ID}`,
					client_secret: `${env.DB_CLIENT_SECRET}`
				}
				var bodyReqToken = [];
				for (var property in access) {
					var encodedKey = encodeURIComponent(property);
					var encodedValue = encodeURIComponent(access[property]);
					bodyReqToken.push(encodedKey + "=" + encodedValue);
				}
				bodyReqToken = bodyReqToken.join("&");				
				var access_token;
				await fetch("https://api.dropbox.com/oauth2/token", {
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
					},
					body: bodyReqToken,
				}).then(response => response.json()).then(data=>{ access_token=data.access_token; })
				if (access_token == undefined) {
					console.log("error getting access token from DropBox");
				} else {
					console.log("Got access token for DropBox application")
					// upload attachments
					for (const att of parsedEmail.attachments) {
						const dropBoxResponse = await fetch("https://content.dropboxapi.com/2/files/upload", {
							method: "POST",
							headers: {
							"Authorization": `Bearer ${access_token}`,
							"Content-Type": "application/octet-stream",
							"Dropbox-API-Arg": '{"path":"/Racunovodstvo KCODE/Izvodi/' + attFileName + '"}'
							},
							body: att.content
						});
						console.log("DropBox upload response code: " + dropBoxResponse.status);
					}
				}
			} else {
				console.log("Not a bank statement. Skipping sending to DropBox")
			}
		}
		console.log(`Forwading message to: ${env.FORWARD_TO}`);
		await message.forward(env.FORWARD_TO);
	},
};
