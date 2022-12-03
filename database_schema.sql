create table user_data
(
	UserId int auto_increment
		primary key,
	UserName text not null,
	UserEmail text not null,
	UserPassword text not null,
	UserVerified int default 0 not null,
	SendContactInfo tinyint default 0 not null,
	GroupId text null,
	constraint UserId
		unique (UserId)
);

create table user_groups
(
	GroupId int auto_increment
		primary key,
	Code varchar(1000) not null
);

