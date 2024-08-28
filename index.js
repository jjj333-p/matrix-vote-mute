//Import dependencies
import {
	// AutojoinRoomsMixin,
	MatrixClient,
	SimpleFsStorageProvider,
	RichRepliesPreprocessor,
} from "matrix-bot-sdk";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

//Parse YAML configuration file
const loginFile = readFileSync("./db/login.yaml", "utf-8");
const loginParsed = parse(loginFile);
const homeserver = loginParsed["homeserver-url"];
const accessToken = loginParsed["login-token"];

//example workingState
const wsFile = readFileSync("./example/expected-state.json", "utf-8");
const exampleWS = JSON.parse(wsFile);

//the bot sync something idk bro it was here in the example so i dont touch it ;-;
const storage = new SimpleFsStorageProvider("bot.json");

//login to client
const client = new MatrixClient(homeserver, accessToken, storage);
// AutojoinRoomsMixin.setupOnClient(client);

// //do not include replied message in message
// client.addPreprocessor(new RichRepliesPreprocessor(false));

const filter = {
	//dont expect any presence from m.org, but in the case presence shows up its irrelevant to this bot
	presence: { senders: [] },
	room: {
		//ephemeral events are never used in this bot, are mostly inconsequentail and irrelevant
		ephemeral: { senders: [] },
		//we fetch state manually later, hopefully with better load balancing
		state: {
			senders: [],
			types: [],
			lazy_load_members: true,
		},
		//we will manually fetch events anyways, this is just limiting how much backfill bot gets as to not
		//respond to events far out of view
		timeline: {
			limit: 1000,
		},
	},
};

const workingState = new Map();

async function doneVote(roomID) {
	const state = workingState.get(roomID);

	//straight out of shatgpt
	const highestVoteKey = Object.entries(state.current.votes).reduce(
		(maxKey, [key, value]) => {
			return value > votes[maxKey] ? key : maxKey;
		},
		Object.keys(votes)[0],
	);

	const now = Date.now();

	last = structuredClone(state);

	state.current = { votes: {}, end: now + 1000 * 60, event: {}, voted: [] };
}

//Start Client
client.start(filter).then(async (filter) => {
	console.log("Client started!");

	//get mxid
	mxid = await client.getUserId().catch(() => {});

	// client.getRoomStateEvent()

	for (const roomID of await client.getJoinedRooms()) {
		let state = await client
			.getRoomStateEvent(roomID, "agency.pain.vote-mute.working-state", "")
			.catch(() => {});

		if (!state) {
			state = structuredClone(exampleWS);
			client
				.sendNotice(
					roomID,
					"Unable to fetch working state from room state, treating this room as new.",
				)
				.catch(() => {});
		}

		workingState.set(roomID, state);

		if (state.current.end < Date.now()) {
			doneVote(roomID);
		}
	}
});

//when the client recieves an event
client.on("room.event", async (roomID, event) => {});
