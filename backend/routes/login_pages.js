
const express = require('express')
const passport = require('passport')
const {User} = require('../models/index')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { isLoggedIn, isNotLoggedIn } = require('./middleware')


const router = express.Router();

// 회원가입 api 처리
/**
 * @swagger
 * /user/register:
 *  post:
 *    summary: 유저의 회원가입과 관련된 api
 *    tags:
 *      - USER
 *    requestBody:
 *      description: 프로필 이미지, 아이디, 닉네임, 비밀번호1,2를 body에 담아 보낸다.
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              profile_img:
 *                type: string
 *                example: 유저 프로필 이미지 파일
 *              id:
 *                tpye: string
 *                example: 유저 아이디
 *              name:
 *                type: string
 *                example: 유저의 닉네임
 *              password:
 *                type: string
 *                example: 유저의 비밀번호1
 *              confirmpassword:
 *                type: string
 *                example: 유저의 비밀번호2
 *    responses:
 *      200:
 *        description: 회원가입 성공 후 로그인 페이지로 이동합니다.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                success:
 *                  type: boolean
 *                message:
 *                  type: string
 *                  example: 회원가입 성공
 *      400:
 *        description: 아이디가 이미 존재하는 경우
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                success:
 *                  type: boolean
 *                  example: false
 *                message:
 *                  type: string
 *                  example: 이미 존재하는 아이디입니다.
 *      500:
 *        description: 서버 내부 에러
 */
router.post("/register", isNotLoggedIn, async (req, res, next) => {
  try {
    const { img, id, name, password, confirmpassword } = req.body;
    // 유저 테이블 내부에 id가 중복인지 확인
    const user = await User.findOne({
      where: {
        id: id,
      },
    });
    // 중복된 아이디라면 400에러를 보낸다.
    if (user) {
      const response = {
        success: false,
        message: "이미 존재하는 아이디입니다.",
      };
      return res.status(400).json(response);
    }

    // 존재하지 않는 아이디라면 해쉬로 만들어서 저장 후 확인메시지를 보낸다.
    const hash = await bcrypt.hash(password, 12);
    await User.create({
      id,
      name,
      password: hash,
      profile_image: img,
    });
    const response = { success: true, message: "회원가입 성공" };
    return res.json(response);
  } catch (err) {
    console.error(err);
    next(err);
  }
});

// 로그인 api 처리
/**
 * @swagger
 * /user/login/local:
 *  post:
 *    summary: 로컬 로그인과 관련된 api
 *    tags:
 *    - USER
 *    requestBody:
 *      description: 유저의 아이디와 비밀번호를 body에 담아 보낸다.
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              id:
 *                type: string
 *                example: 유저 아이디
 *              password:
 *                type: string
 *                example: 유저 비밀번호
 *    responses:
 *      200:
 *        description: 로그인 성공
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                success:
 *                  type: boolean
 *                  example: true
 *                message:
 *                  type: string
 *                  example: 로그인 완료
 *      400:
 *        description: 가입되지 않은 유저의 경우
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                success:
 *                  type: boolean
 *                  example: false
 *                message:
 *                  type: string
 *                  example: 가입되지 않은 회원입니다.
 *      401:
 *        description: 비밀번호가 틀린 경우
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                success:
 *                  type: boolean
 *                  example: false
 *                message:
 *                  type: string
 *                  example: 비밀번호가 일치하지 않습니다.
 *      500:
 *        description: 서버 에러
 */
// 우선 처음 로그인 하는 경우 jwt를 발급해주자.
router.post("/login/local", isNotLoggedIn, (req, res, next) => {
  passport.authenticate("login", { session: false }, (err, user, info) => {
    // 서버에러가 발생하는 경우
    if (err) {
      return next(err);
    }
    // 회원가입한 유저가 아닌 경우
    if (!user) {
      if (info.message === "no user") {
        return res
          .status(400)
          .json({ success: false, message: "가입되지 않은 회원입니다." });
      } else {
        return res
          .status(401)
          .json({ success: false, message: "비밀번호가 일치하지 않습니다." });
      }
    }

    // 로그인이 확인되었다면 생성한 토큰을 전달한다.
    // user.index, user.id 정보를 토큰에 넣어서 전달한다.
    const token = jwt.sign(
      {
        user_index: user.index,
        user_id: user.id,
      },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "1d",
      }
    );

    res.cookie("accessToken", token, {
      expires: new Date(Date.now() + 24 * 3600000), // 1일 뒤에 사라짐
      httpOnly: true,
      sameSite: "None"
    });

    return res.json({ success: true, message: "로그인 완료" });
  })(req, res, next);
});

// 로그아웃 api 처리
/**
 * @swagger
 * /user/logout:
 *  get:
 *    summary: 로그아웃과 관련된 api
 *    tags:
 *    - USER
 *    ApiKeyAuth:
 *      type: apiKey
 *      in: header
 *      name: accessToken
 *    responses:
 *      200:
 *        description: 로그아웃 성공
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                success:
 *                  type: boolean
 *                  example: true
 *                message:
 *                  type: string
 *                  example: 로그아웃 성공
 *      401:
 *        description: 토큰이 잘못된 경우
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                success:
 *                  type: boolean
 *                  example: false
 *                message:
 *                  type: string
 *                  example: 유효하지 않은 토큰입니다.
 *      419:
 *        description: 토큰이 만료된 경우 기본은 1일이 지나야 만료됨
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                success:
 *                  type: boolean
 *                  example: false
 *                message:
 *                  type: string
 *                  example: 만료된 토큰입니다.
 *      500:
 *        description: 서버 에러
 */
router.get("/logout", isLoggedIn, (req, res, next) => {
  res.clearCookie("accessToken", { httpOnly: true });
  res.json({ success: true, message: "로그아웃 성공" });
});

/**
 * @swagger
 * /user/login/kakao:
 *  get:
 *    summary: 카카오 회원가입, 로그인과 관련된 api
 *    tags:
 *    - USER
 *    responses:
 *      200:
 *        description: 카카오 로그인 성공
 *        content:
 *          application/json:
 *            schema:
 *              success:
 *                type: boolean
 *                example: true
 *              message:
 *                type: string
 *                example: 로그인 완료
 *      400:
 *        description: 로그인이 되어있는 상태에서 시도하는 경우
 *        content:
 *          application/json:
 *            schema:
 *              success:
 *                type: boolean
 *                example: false
 *              message:
 *                type: string
 *                example: 유효하지 않은 접근입니다.
 *      500:
 *        description: 서버 에러
 */
// 카카오 로그인 및 회원가입 api
router.get(
  "/login/kakao",
  isNotLoggedIn,
  passport.authenticate("kakao", { session: false })
);

// 카카오 리다이랙트 api
router.get("/callback/kakao", (req, res, next) => {
  passport.authenticate("kakao", { session: false }, (err, user, info) => {
    // 서버 에러
    if (err) return next(err);

    const userObject = user[0].dataValues;
    // 토큰 발급
    const token = jwt.sign(
      {
        user_index: userObject.index,
        user_id: userObject.id,
      },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "1d",
      }
    );

    res.cookie("accessToken", token, {
      expires: new Date(Date.now() + 24 * 3600000), // 1일 뒤에 사라짐
      httpOnly: true,
    });

    return res.json({ success: true, message: "로그인 완료" });
  })(req, res, next);
});

/**
 * @swagger
 * /user/test1:
 *  get:
 *    summary: isLoggedIn 함수 테스트입니다. 백엔드에서만 사용합니다.
 *    tags:
 *    - USER
 *    ApiKeyAuth:
 *      type: apiKey
 *      in: header
 *      name: accessToken
 *    responses:
 *      200:
 *        description: 테스트 성공
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                success:
 *                  type: boolean
 *                  example: true
 *                index:
 *                  type: string
 *                  example: 2
 *                id:
 *                  type: string
 *                  example: 유저 아이디
 *      401:
 *        description: 토큰이 잘못된 경우
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                success:
 *                  type: boolean
 *                  example: false
 *                message:
 *                  type: string
 *                  example: 유효하지 않은 토큰입니다.
 *      419:
 *        description: 토큰이 만료된 경우 기본은 1일이 지나야 만료됨
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                success:
 *                  type: boolean
 *                  example: false
 *                message:
 *                  type: string
 *                  example: 만료된 토큰입니다.
 *      500:
 *        description: 서버 에러
 */
router.get("/test1", isLoggedIn, (req, res, next) => {
  const index = req.user.user_index;
  const id = req.user.user_id;
  res.json({ success: true, index, id, message: "isLoggedIn 함수 정상 작동" });
});

/**
 * @swagger
 * /user/test2:
 *  get:
 *    summary: isNotLoggedIn 테스트입니다. 백엔드에서만 사용합니다.
 *    tags:
 *    - USER
 *    ApiKeyAuth:
 *      type: apiKey
 *      in: header
 *      name: accessToken
 *    responses:
 *      200:
 *        description: 로그인 안된 상태 확인 완료
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                success:
 *                  type: boolean
 *                  example: true
 *                index:
 *                  type: string
 *                  example: 2
 *                id:
 *                  type: string
 *                  example: 유저 아이디
 *      400:
 *        description: 로그인이 된 상태로 접근하는 경우
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                success:
 *                  type: boolean
 *                  example: false
 *                message:
 *                  type: string
 *                  example: 유효하지 않은 접근입니다.
 *      500:
 *        description: 서버 에러
 */
router.get("/test2", isNotLoggedIn, (req, res, next) => {
  res.json({ success: true, message: "isNotLoggedIn 함수 정상 작동" });
});

module.exports = router;
