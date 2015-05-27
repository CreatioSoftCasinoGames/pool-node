module.exports = {

	createClub: function(club, redis) {
		redis.sadd("clubs", "club:"+club.id);
		redis.sadd("club_config_clubs:"+club.club_config_id, "club:"+club.id);
		redis.zadd("club_config_occupancy:"+club.club_config_id, 0, "club:"+club.id);
    redis.hmset("club:"+club.id, "club_config_id", club.club_config_id, "name",club.name);
	},

}




