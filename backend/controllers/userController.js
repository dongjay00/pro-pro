const { statusCode, responseMessage } = require('../globals');
const { resFormatter } = require('../utils');
const { COOKIE_TOKEN_FIELD } = require('../middlewares/auth');
const jwt = require('../libs/jwt.js');
const asyncHandler = require('../utils/asyncHandler');
const nicknameGenerator = require('../libs/nicknameGenerator');

const userService = require('../services/userService');

const { ValidationError } = require('../utils/errors/commonError');
const {
  AlreadyBookmarkError,
  NoBookmarkError,
} = require('../utils/errors/bookmarkError');
const {
  CategoryTypeError,
  StackNotLowerCaseError,
} = require('../utils/errors/postError');

const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const { PROFILE_URL } = require('../configs/profileImage');
const {
  CLIENT_URL,
  // KAKAO_AUTH_URL,
  KAKAO_AUTH_REDIRECT_URL,
  KAKAO_SERVER_URL,
  KAKAO_TOKEN_URL,
  KAKAO_ACCESS_URL,
  // GOOGLE_AUTH_URL,
  GOOGLE_AUTH_TOKEN_URL,
  GOOGLE_AUTH_REDIRECT_URL,
  GOOGLE_SERVER_URL,
  GOOGLE_ACCESS_URL,
} = require('../configs/oauth');

// 카카오 OAuth 서버에 리다이랙트
exports.authKakao = (req, res, next) => {
  return res.redirect(KAKAO_SERVER_URL);
};

// 카카오 OAuth로부터 정보 받아오기
exports.callbackKakao = asyncHandler(async (req, res, next) => {
  const { code } = req.query;

  const { data } = await axios({
    method: 'POST',
    url: KAKAO_TOKEN_URL,
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    params: {
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_CLIENT_ID,
      client_secret: process.env.KAKAO_SECRET_ID,
      redirectUri: KAKAO_AUTH_REDIRECT_URL,
      code: code,
    },
  });

  const kakao_access_token = data['access_token'];

  const { data: me } = await axios({
    method: 'GET',
    url: KAKAO_ACCESS_URL,
    headers: {
      authorization: `bearer ${kakao_access_token}`,
    },
  });

  const { id, kakao_account } = me;
  const nickname = await nicknameGenerator.generateNickname();

  const userInformation = {
    snsId: id,
    snsType: 'kakao',
    imageURL: kakao_account.profile.thumbnail_image_url || PROFILE_URL,
    nickname,
  };

  const alreadyUser = await userService.isExistSnsId(
    userInformation.snsType,
    userInformation.snsId,
  );

  // 이미 존재하는 유저인 경우 토큰 생성
  if (alreadyUser) {
    const alreadyUserJwt = await jwt.sign(alreadyUser);

    const cookieOption = {
      domain: req.hostname,
      // second to milisecond
      expires: new Date(alreadyUserJwt.expires * 1000),
    };
    return res
      .cookie(COOKIE_TOKEN_FIELD, alreadyUserJwt.accessToken, cookieOption)
      .redirect(CLIENT_URL);
  }

  // 존재하지 않는 유저인 경우 정보 저장 후 토큰 생성
  const newUser = await userService.snsSignUp(userInformation);

  const newUserJwt = await jwt.sign(newUser);

  const cookieOption = {
    domain: req.hostname,
    // second to milisecond
    expires: new Date(newUserJwt.expires * 1000),
  };

  return res
    .cookie(COOKIE_TOKEN_FIELD, newUserJwt.accessToken, cookieOption)
    .redirect(CLIENT_URL);
});

// 구글 OAuth 서버에 리다이랙트
exports.authGoogle = (req, res, next) => {
  return res.redirect(GOOGLE_SERVER_URL);
};

// 구글 OAuth로부터 정보 받아오기
exports.callbackGoogle = asyncHandler(async (req, res, next) => {
  const { code } = req.query;

  const { data } = await axios({
    method: 'POST',
    url: `${GOOGLE_AUTH_TOKEN_URL}`,
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    params: {
      grant_type: 'authorization_code',
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_SECRET_ID,
      redirectUri: GOOGLE_AUTH_REDIRECT_URL,
      code: code,
    },
  });

  const access_token = data['access_token'];

  const { data: me } = await axios.get(`${GOOGLE_ACCESS_URL}=${access_token}`);

  const { sub, picture } = me;
  const nickname = await nicknameGenerator.generateNickname();

  const userInformation = {
    snsId: sub,
    snsType: 'google',
    imageURL: picture || PROFILE_URL,
    nickname,
  };

  const alreadyUser = await userService.isExistSnsId(
    userInformation.snsType,
    userInformation.snsId,
  );

  // 이미 존재하는 유저인 경우 토큰 생성
  if (alreadyUser) {
    const alreadyUserJwt = await jwt.sign(alreadyUser);

    const cookieOption = {
      domain: req.hostname,
      // second to milisecond
      expires: new Date(alreadyUserJwt.expires * 1000),
    };
    return res
      .cookie(COOKIE_TOKEN_FIELD, alreadyUserJwt.accessToken, cookieOption)
      .redirect(CLIENT_URL);
  }

  // 존재하지 않는 유저인 경우 정보 저장 후 토큰 생성
  const newUser = await userService.snsSignUp(userInformation);

  const newUserJwt = await jwt.sign(newUser);

  const cookieOption = {
    domain: req.hostname,
    // second to milisecond
    expires: new Date(newUserJwt.expires * 1000),
  };

  return res
    .cookie(COOKIE_TOKEN_FIELD, newUserJwt.accessToken, cookieOption)
    .redirect(CLIENT_URL);
});

// 유저 존재 여부 체크 (실제 사용하지 않을 예정)
exports.checkSnsId = asyncHandler(async (req, res, next) => {
  const { snsType, snsId } = req.params;

  const user = await userService.isExistSnsId(snsType, snsId);

  // 존재하지 않는 유저의 경우
  if (!user) {
    return res.status(statusCode.OK).send(
      resFormatter.success(responseMessage.FAIL_SNS_CHECK, {
        snsType,
        snsId,
      }),
    );
  }

  // 이미 존재하는 유저인 경우 토큰 생성
  const jwtResult = await jwt.sign(user);

  const cookieOption = {
    domain: req.hostname,
    // second to milisecond
    expires: new Date(jwtResult.expires * 1000),
  };
  return res
    .cookie(COOKIE_TOKEN_FIELD, jwtResult.accessToken, cookieOption)
    .status(statusCode.OK)
    .send(resFormatter.success(responseMessage.LOGIN_SUCCESS, {}));
});

// 유저 생성 (실제 사용하지 않을 예정)
// exports.postUser = asyncHandler(async (req, res, next) => {
//   // 데이터 전처리
//   const { snsType, snsId, nickname, position, stacks, region, imageURL } =
//     req.body;
//   const { sido, sigungu } = region;

//   // 유저 중복체크는 추후에 결정

//   const user = await userService.snsSignUp({
//     snsType,
//     snsId,
//     nickname,
//     position,
//     stacks,
//     sido,
//     sigungu,
//     imageURL,
//   });

//   const jwtResult = await jwt.sign(user);

//   const cookieOption = {
//     domain: req.hostname,
//     // second to milisecond
//     expires: new Date(jwtResult.expires * 1000),
//   };

//   return res
//     .cookie(COOKIE_TOKEN_FIELD, jwtResult.accessToken, cookieOption)
//     .status(statusCode.CREATED)
//     .send(resFormatter.success(responseMessage.CREATED_USER, {}));
// });

// 프로필 정보 가져오기
exports.getUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.decoded;

  const user = await userService.checkUser(userId);

  // 유저의 북마크 목록 가져오기
  const bookmarks = await userService.getBookmarkList(
    userId,
    'category',
    'skipSize',
    'perPage',
  );

  const region = {
    sido: user.sido,
    sigungu: user.sigungu,
  };
  const { _id, nickname, position, stacks, imageURL } = user;

  return res.status(statusCode.OK).send(
    resFormatter.success(responseMessage.SUCCESS, {
      _id,
      nickname,
      position,
      stacks,
      imageURL,
      region,
      bookmarks,
    }),
  );
});

// 프로필 정보 수정하기
exports.updateUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.decoded;

  // 데이터 전처리
  const { nickname, position, stacks, region, imageURL } = req.body;
  const { sido, sigungu } = region;

  if (!nickname) throw new ValidationError();

  // 스택 소문자로만 이루어진 형식인지 체크
  stacks.forEach(stack => {
    if (!/^[a-z]+$/.test(stack)) throw new StackNotLowerCaseError();
  });

  await userService.updateUser(userId, {
    nickname,
    position,
    stacks,
    sido,
    sigungu,
    imageURL: imageURL || PROFILE_URL,
  });

  return res
    .status(statusCode.OK)
    .send(resFormatter.success(responseMessage.USER_UPDATED, {}));
});

// 유저 닉네임 중복 체크 (실제 사용하지 않을 예정)
exports.checkNickname = asyncHandler(async (req, res, next) => {
  const { nickname } = req.params;

  const user = await userService.isExistNickname(nickname);

  // 이미 해당 닉네임을 가진 유저가 존재한다면
  if (user) {
    return res
      .status(statusCode.CONFLICT)
      .send(resFormatter.success(responseMessage.DUPLICATE_NICKNAME, {}));
  }

  return res
    .status(statusCode.OK)
    .send(resFormatter.success(responseMessage.AVAILABLE_NICKNAME, {}));
});

// 북마크 추가
exports.postBookmark = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const { userId } = req.decoded;

  // 이미 존재하는 북마크인지 체크
  const alreadyBookmark = await userService.isExistBookmark(userId, postId);
  if (alreadyBookmark) throw new AlreadyBookmarkError();

  const bookmarkCount = await userService.createBookmark(userId, postId);

  return res.status(statusCode.CREATED).send(
    resFormatter.success(responseMessage.CREATE_BOOKMARK_SUCCESS, {
      bookmarkCount,
    }),
  );
});

// 북마크 삭제
exports.deleteBookmark = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const { userId } = req.decoded;

  // 이미 존재하는 북마크인지 체크
  const alreadyBookmark = await userService.isExistBookmark(userId, postId);
  if (!alreadyBookmark) throw new NoBookmarkError();

  const bookmarkCount = await userService.deleteBookmark(userId, postId);

  return res.status(statusCode.OK).send(
    resFormatter.success(responseMessage.DELETE_BOOKMARK_SUCCESS, {
      bookmarkCount,
    }),
  );
});

// 북마크 목록
exports.getBookmarkList = asyncHandler(async (req, res, next) => {
  const { userId } = req.decoded;
  const category = req.query.category;
  const page = Number(req.query.page || 1);
  const perPage = Number(req.query.perPage || 10);
  const skipSize = (page - 1) * perPage;

  // 카테고리 체크
  if (category !== 'project' && category !== 'study')
    throw new CategoryTypeError();

  const bookmarkList = await userService.getBookmarkList(
    userId,
    category,
    skipSize,
    perPage,
  );

  return res
    .status(statusCode.OK)
    .send(resFormatter.success(responseMessage.SUCCESS, bookmarkList));
});

// 회원가입 및 로그인
exports.postUser = asyncHandler(async (req, res, next) => {
  // 데이터 전처리
  const { snsType, snsId, imageURL } = req.body;

  const nickname = await nicknameGenerator.generateNickname();

  const userInformation = {
    snsId,
    snsType,
    imageURL: imageURL || PROFILE_URL,
    nickname,
  };

  const alreadyUser = await userService.isExistSnsId(
    userInformation.snsType,
    userInformation.snsId,
  );

  // 이미 존재하는 유저인 경우 토큰 생성
  if (alreadyUser) {
    const alreadyUserJwt = await jwt.sign(alreadyUser);

    const cookieOption = {
      domain: req.hostname,
      // second to milisecond
      expires: new Date(alreadyUserJwt.expires * 1000),
    };
    return res
      .cookie(COOKIE_TOKEN_FIELD, alreadyUserJwt.accessToken, cookieOption)
      .status(statusCode.OK)
      .send(
        resFormatter.success(responseMessage.SUCCESS, {
          ...alreadyUser._doc,
          AG3_JWT: alreadyUserJwt.accessToken,
        }),
      );
  }

  // 존재하지 않는 유저인 경우 정보 저장 후 토큰 생성
  const newUser = await userService.snsSignUp(userInformation);

  const newUserJwt = await jwt.sign(newUser);

  const cookieOption = {
    domain: req.hostname,
    // second to milisecond
    expires: new Date(newUserJwt.expires * 1000),
  };

  return res
    .cookie(COOKIE_TOKEN_FIELD, newUserJwt.accessToken, cookieOption)
    .status(statusCode.CREATED)
    .send(
      resFormatter.success(responseMessage.SUCCESS, {
        ...newUser._doc,
        AG3_JWT: newUserJwt.accessToken,
      }),
    );
});
