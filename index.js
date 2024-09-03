import { createApp } from "@deroll/app";
import { hexToString, stringToHex } from "viem";

const app = createApp({ url: process.env.ROLLUP_HTTP_SERVER_URL || "http://127.0.0.1:5004" });

let auctions = {};
let bids = {};

app.addAdvanceHandler(async ({ metadata, payload }) => {
    const sender = metadata.msg_sender;
    const payloadString = hexToString(payload);
    console.log("Sender:", sender, "Payload:", payloadString);

    try {
        const jsonPayload = JSON.parse(payloadString);
        if (jsonPayload.method === "create_auction") {
            const { auctionId, item, reservePrice } = jsonPayload;
            auctions[auctionId] = { item, reservePrice, highestBid: 0, highestBidder: null };
            console.log(`Auction created: ${auctionId} - ${item}`);
        } else if (jsonPayload.method === "place_bid") {
            const { auctionId, amount } = jsonPayload;
            if (auctions[auctionId] && amount > auctions[auctionId].highestBid) {
                auctions[auctionId].highestBid = amount;
                auctions[auctionId].highestBidder = sender;
                console.log(`Bid placed: ${auctionId} - ${amount}`);
            }
        } else if (jsonPayload.method === "end_auction") {
            const { auctionId } = jsonPayload;
            const auction = auctions[auctionId];
            if (auction) {
                console.log(`Auction ended: ${auctionId} - Winner: ${auction.highestBidder} - Amount: ${auction.highestBid}`);
                delete auctions[auctionId];
            }
        }
        return "accept";
    } catch (e) {
        console.error(e);
        app.createReport({ payload: stringToHex(String(e)) });
        return "reject";
    }
});

app.addInspectHandler(async ({ payload }) => {
    const url = hexToString(payload).split("/"); // e.g., "rollup/auction/123"
    console.log("Inspect call:", url);

    if (url[1] === "auction") {
        const auctionId = url[2];
        const auction = auctions[auctionId] || "Auction not found";
        await app.createReport({ payload: stringToHex(JSON.stringify(auction)) });
    } else {
        console.log("Invalid inspect call");
        await app.createReport({ payload: stringToHex("Invalid inspect call") });
    }
});

app.start().catch((e) => {
    console.error(e);
    process.exit(1);
});
