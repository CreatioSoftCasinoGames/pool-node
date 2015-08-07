module.exports = {

	createClub: function(clubDetails, redis) {
		console.log("Redis entry for club");
		console.log(clubDetails);
		var club = clubDetails.club;
		redis.sadd("clubs", "club:"+club.id);
		redis.sadd("club_config_clubs:"+club.club_config_id, "club:"+club.id);
		redis.zadd("club_config_occupancy:"+club.club_config_id, 0, "club:"+club.id);
    //redis.hmset("club:"+club.id, "club_config_id", club.club_config_id, "name",club.name, "entry_fees", club.entry_fees, "winner_amount", club.winner_amount);
		redis.hmset("club:"+club.id, "club_config_id", club.club_config_id, "name",club.name, "entry_fees", club.entry_fees, "winner_amount", club.winner_amount, "club_type",  clubDetails.clubType);
	},

}



