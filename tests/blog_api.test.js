const supertest = require("supertest")

const app = require("../app")
const api = supertest(app)

const mongoose = require("mongoose")
mongoose.set("useFindAndModify", false)

const Blog = require("../models/blog")
const User = require("../models/user")

const helper = require("../utils/test_helper")
const bcrypt = require("bcrypt")

beforeAll(async () => {
    const user = {
        username: "testuser",
        password: "averysecurepassword1!"
    }

    const res = await api.post('/api/login').send(user)

    helper.token = `Bearer ${res.body.token}`
})

beforeEach(async () => {
    await Blog.deleteMany({})

    for (const blog of helper.initialBlogs) {
        await new Blog(blog).save()
    }
})

describe("GET", () => {
    test("The return type for the get request is json", async () => {
        await api
            .get("/api/blogs")
            .expect(200)
            .expect("Content-Type", /application\/json/)
    })

    test("The field of the unique identifier is \"id\" and not \"_id\"", async () => {
        const res = await api.get("/api/blogs")
        res.body.forEach(blog => {
            expect(blog.id).toBeDefined()
            expect(blog._id).not.toBeDefined()
        })
    })
})

describe("POST", () => {

    const newBlog = {
        title: "New Blog",
        author: "New Author",
        url: "New URL",
        likes: 6
    }

    const createBlog = async (blog) => {
        await api
            .post("/api/blogs")
            .set('Authorization', helper.token)
            .send(blog)
            .expect(201)
            .expect("Content-Type", /application\/json/)

        return await helper.returnBlogs()
    }

    test("Creating a new blog post increases the number of blogs by one", async () => {
        const newBlogList = await createBlog(newBlog)
        expect(newBlogList.length).toBe(helper.initialBlogs.length + 1)
    })

    test("Verify title of a new blog post", async () => {
        const newBlogList = await createBlog(newBlog)
        const title = newBlogList.map(blog => blog.title)
        expect(title).toContain(newBlog.title)
    })

    test("Verify author of a new blog post", async () => {
        const newBlogList = await createBlog(newBlog)
        const author = newBlogList.map(blog => blog.author)
        expect(author).toContain(newBlog.author)
    })

    test("Verify url of a new blog post", async () => {
        const newBlogList = await createBlog(newBlog)
        const url = newBlogList.map(blog => blog.url)
        expect(url).toContain(newBlog.url)
    })

    test("If likes are empty, verify that it will default to 0", async () => {
        const noLikes = {
            title: "New Blog",
            author: "New Author",
            url: "New URL"
        }

        const res = await api
            .post("/api/blogs")
            .set('Authorization', helper.token)
            .send(noLikes)

        expect(res.body.likes).toBe(0)
    })

    describe("If _____ is missing, the server responds with code 400", () => {
        test("Title", async () => {
            const noTitle = {
                author: "New Author",
                url: "New URL",
                likes: 10
            }
            await api.post("/api/blogs")
                .set('Authorization', helper.token)
                .send(noTitle)
                .expect(400)
        })

        test("Url", async () => {
            const noTitle = {
                title: "New Title",
                author: "New Author",
                likes: 10
            }
            await api.post("/api/blogs")
                .set('Authorization', helper.token)
                .send(noTitle)
                .expect(400)
        })

        test("Title and Url", async () => {
            const noTitle = {
                author: "New Author",
                likes: 10
            }
            await api.post("/api/blogs")
                .set('Authorization', helper.token)
                .send(noTitle)
                .expect(400)
        })
    })
})

describe("DELETE", () => {
    test("Delete an existing blog with an invalid token", async () => {
        const before = await helper.returnBlogs()
        const { id } = before[0]

        //const id = createBlog(newBlog)

        await api.delete(`/api/blogs/${id}`)
            .expect(401)

        const after = await helper.returnBlogs()
        const idsAfter = after.map(blog => blog.id)
        expect(after.length).toBe(before.length)
        expect(idsAfter).toContain(id)
    })

    /*test("Delete a blog with an id that has an invalid format", async () => {
        const id = "thisisnotanid"
        await api.delete(`/api/blogs/${id}`).expect(400)
    })

    test("Delete a blog with a non existent id", async () => {
        const id = await helper.generateID()
        await api.delete(`/api/blogs/${id}`).expect(404)
    })*/
})

describe("UPDATE", () => {
    test("Update an existing blog", async () => {
        const before = await helper.returnBlogs()
        const updateBlog = before[0]

        await api.put(`/api/blogs/${updateBlog.id}`)
            .send({likes: updateBlog.likes + 1})
            .set('Authorization', helper.token)
            .expect(200)
            .expect('Content-Type', /application\/json/)

        const after = await helper.returnBlogs()
        const updatedBlog = after.find(blog => blog.id === updateBlog.id)
        expect(updatedBlog.likes).toBe(updateBlog.likes + 1)
    })

    test("Update a blog with an id that has an invalid format", async () => {
        const id = "thisisnotanid"
        await api.put(`/api/blogs/${id}`).expect(400)
    })

    test("Update a blog with a non existent id", async () => {
        const id = await helper.generateID()
        await api.put(`/api/blogs/${id}`).expect(404)
    })
})

afterAll(() => {
    mongoose.connection.close()
})